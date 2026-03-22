/**
 * @fileoverview Setup and rebuild logic for the WinCC OA DP Inspector Server.
 *
 * Provides commands to:
 * - Run initial setup:  clone repo, npm ci, build, add progs entry
 * - Check installation: determine if the server is installed and in progs
 * - Rebuild/update:     git pull (or re-clone) + npm ci + build
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { PmonComponent, ProjEnvManagerOptions } from '@winccoa-tools-pack/npm-winccoa-core';
import { ExtensionOutputChannel } from './extensionOutput';
import { EXTENSION_CONFIG_SECTION } from './const';
import type { ProjectInfo } from './otherExtensions';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default server repository URL (configurable via settings). */
const DEFAULT_REPO_URL =
    'https://github.com/winccoa-tools-pack/winccoa-dp-inspector-server';

/** Default branch to clone/pull (configurable via settings). */
const DEFAULT_BRANCH = 'main';

/**
 * Sub-directory name under `<project>/javascript/` where the server is installed.
 * WinCC OA automatically prepends `<project>/javascript/` to node manager paths.
 */
const SERVER_DIR_NAME = 'dpInspectorServer';

/** String used to identify the progs entry (unique enough to avoid false positives). */
const PROGS_ENTRY_MARKER = `${SERVER_DIR_NAME}/dist/index.js`;

/**
 * The full progs line for the node manager.
 * Format: `<component> | <startMode> | <secondToKill> | <resetStartCounter> | <resetMin> | <options>`
 */
const PROGS_ENTRY = `node             | always |      30 |        3 |        1 |${PROGS_ENTRY_MARKER}`;

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result of checking the server installation and progs entry. */
export interface ServerStatus {
    /** Whether `javascript/dpInspectorServer/dist/index.js` exists. */
    isInstalled: boolean;
    /** Whether the progs file contains the server entry. */
    hasProgsEntry: boolean;
    /** Absolute path to the server installation directory. */
    serverPath: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks whether the dp-inspector-server is installed and registered in progs
 * for a given WinCC OA project directory.
 *
 * @param projectPath - Absolute path to the WinCC OA project directory.
 */
export function checkServerStatus(projectPath: string): ServerStatus {
    const serverPath = path.join(projectPath, 'javascript', SERVER_DIR_NAME);
    const progsPath = path.join(projectPath, 'config', 'progs');

    const isInstalled = fs.existsSync(path.join(serverPath, 'dist', 'index.js'));

    let hasProgsEntry = false;
    if (fs.existsSync(progsPath)) {
        const content = fs.readFileSync(progsPath, 'utf8');
        hasProgsEntry = content.includes(PROGS_ENTRY_MARKER);
    }

    return { isInstalled, hasProgsEntry, serverPath };
}

/**
 * Adds the progs manager entry for the given WinCC OA project directory.
 * No-op if the entry already exists.
 *
 * @param projectPath - Absolute path to the WinCC OA project directory.
 */
export function addProgsEntryForProject(projectPath: string): void {
    const progsPath = path.join(projectPath, 'config', 'progs');
    addProgsEntry(progsPath);
}

/**
 * Full setup workflow:
 * 1. Clone server repo from GitHub (branch configurable via settings)
 * 2. `npm ci --omit=dev`
 * 3. `npm run build`
 * 4. Append progs entry (if not already present)
 *
 * @param project - ProjectInfo from the Project Admin extension API.
 */
export async function runSetup(project: ProjectInfo): Promise<void> {
    const projectPath = project.projectDir!;
    const cfg = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION);
    const repoUrl = cfg.get<string>('server.repoUrl', DEFAULT_REPO_URL);
    const branch = cfg.get<string>('server.branch', DEFAULT_BRANCH);

    const jsDir = path.join(projectPath, 'javascript');
    const serverInstallPath = path.join(jsDir, SERVER_DIR_NAME);
    const progsPath = path.join(projectPath, 'config', 'progs');

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'DP Inspector Server: Setup',
            cancellable: false,
        },
        async (progress) => {
            // ── Step 1: Remove existing dir if present ───────────────────────
            if (fs.existsSync(serverInstallPath)) {
                progress.report({ message: 'Removing existing installation…' });
                ExtensionOutputChannel.info(
                    'ServerSetup',
                    `Removing existing installation at ${serverInstallPath}`,
                );
                fs.rmSync(serverInstallPath, { recursive: true, force: true });
            }

            // Ensure javascript/ directory exists
            if (!fs.existsSync(jsDir)) {
                fs.mkdirSync(jsDir, { recursive: true });
            }

            // ── Step 2: Clone ─────────────────────────────────────────────────
            await runCmd(
                'git',
                ['clone', '--branch', branch, '--depth', '1', repoUrl, SERVER_DIR_NAME],
                jsDir,
                progress,
                `Cloning server (branch: ${branch})…`,
            );

            // ── Step 3: npm ci (needs devDeps for tsc) ───────────────────────
            await runCmd(
                'npm',
                ['ci'],
                serverInstallPath,
                progress,
                'Installing dependencies…',
            );

            // ── Step 4: Build ─────────────────────────────────────────────────
            await runCmd('npm', ['run', 'build'], serverInstallPath, progress, 'Building server…');

            // ── Step 5: Prune devDependencies ─────────────────────────────────
            await runCmd(
                'npm',
                ['prune', '--omit=dev'],
                serverInstallPath,
                progress,
                'Removing dev dependencies…',
            );

            // ── Step 6: Add manager via PMON (fallback: progs file) ────────────
            progress.report({ message: 'Registering manager…' });
            await addManagerViaPmon(project, progsPath);

            progress.report({ message: 'Done!' });
        },
    );

    vscode.window.showInformationMessage(
        'DP Inspector Server setup complete! The node manager has been added and will start automatically.',
    );
}

/**
 * Rebuild/update workflow:
 * 1. `git pull --ff-only` inside the existing installation
 *    (falls back to re-clone if pull fails or repo is dirty)
 * 2. `npm ci` + `npm run build` + `npm prune --omit=dev`
 * Does NOT touch the manager/progs entry.
 *
 * @param project - ProjectInfo from the Project Admin extension API.
 */
export async function runRebuild(project: ProjectInfo): Promise<void> {
    const projectPath = project.projectDir!;
    const serverInstallPath = path.join(projectPath, 'javascript', SERVER_DIR_NAME);

    // Guard: not installed yet
    if (!fs.existsSync(serverInstallPath)) {
        const answer = await vscode.window.showWarningMessage(
            'DP Inspector Server is not installed in this project. Run full setup instead?',
            'Run Setup',
            'Cancel',
        );
        if (answer === 'Run Setup') {
            await runSetup(project);
        }
        return;
    }

    const cfg = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION);
    const repoUrl = cfg.get<string>('server.repoUrl', DEFAULT_REPO_URL);
    const branch = cfg.get<string>('server.branch', DEFAULT_BRANCH);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'DP Inspector Server: Rebuild',
            cancellable: false,
        },
        async (progress) => {
            // ── Step 1: Pull or re-clone ──────────────────────────────────────
            let pulled = false;
            try {
                await runCmd(
                    'git',
                    ['pull', '--ff-only'],
                    serverInstallPath,
                    progress,
                    'Pulling latest changes…',
                );
                pulled = true;
            } catch (err) {
                ExtensionOutputChannel.warn(
                    'ServerSetup',
                    `git pull failed (${String(err)}) — falling back to re-clone`,
                );
            }

            if (!pulled) {
                progress.report({ message: 'Re-cloning server…' });
                fs.rmSync(serverInstallPath, { recursive: true, force: true });
                const jsDir = path.join(projectPath, 'javascript');
                await runCmd(
                    'git',
                    ['clone', '--branch', branch, '--depth', '1', repoUrl, SERVER_DIR_NAME],
                    jsDir,
                    progress,
                    `Re-cloning (branch: ${branch})…`,
                );
            }

            // ── Step 2: npm ci ────────────────────────────────────────────────
            await runCmd(
                'npm',
                ['ci'],
                serverInstallPath,
                progress,
                'Installing dependencies…',
            );

            // ── Step 3: Build ─────────────────────────────────────────────────
            await runCmd('npm', ['run', 'build'], serverInstallPath, progress, 'Building server…');

            // ── Step 4: Prune devDependencies ─────────────────────────────────
            await runCmd(
                'npm',
                ['prune', '--omit=dev'],
                serverInstallPath,
                progress,
                'Removing dev dependencies…',
            );

            progress.report({ message: 'Done!' });
        },
    );

    vscode.window.showInformationMessage(
        'DP Inspector Server rebuilt. Restart the node manager to apply the update.',
    );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** * Tries to add the node manager via PMON at runtime (no project restart required).
 * Falls back to writing the progs file if PMON is unavailable or fails.
 */
async function addManagerViaPmon(project: ProjectInfo, progsPath: string): Promise<void> {
    const projectId = project.id ?? path.basename(project.projectDir ?? '');
    const version = project.version;

    if (projectId && version) {
        try {
            ExtensionOutputChannel.info('ServerSetup', `Adding manager via PMON (project: ${projectId}, version: ${version})`);
            const pmon = new PmonComponent();
            pmon.setVersion(version);

            const managers = await pmon.getManagerOptionsList(projectId);

            // Check if already registered
            const exists = managers.some(
                (m) => m.component === 'node' && m.startOptions?.includes(SERVER_DIR_NAME),
            );
            if (exists) {
                ExtensionOutputChannel.info('ServerSetup', 'Manager already registered in PMON — skipping');
                return;
            }

            const managerOptions: ProjEnvManagerOptions = {
                component: 'node',
                startMode: 2, // always
                secondToKill: 30,
                resetMin: 1,
                resetStartCounter: 3,
                startOptions: `${SERVER_DIR_NAME}/dist/index.js`,
            };

            const exitCode = await pmon.insertManagerAt(managerOptions, projectId, managers.length);

            if (exitCode === 0) {
                ExtensionOutputChannel.info('ServerSetup', '✅ Manager added via PMON successfully');
                return; // done — also write progs as persistent record
            } else {
                throw new Error(`PMON insertManagerAt exited with code ${exitCode}`);
            }
        } catch (err) {
            ExtensionOutputChannel.warn(
                'ServerSetup',
                `PMON manager install failed (${String(err)}) — falling back to progs file`,
            );
        }
    } else {
        ExtensionOutputChannel.warn(
            'ServerSetup',
            'Project id or version missing — skipping PMON, writing progs file',
        );
    }

    // Fallback: write progs file entry
    addProgsEntry(progsPath);
}

/** * Appends the node manager progs entry to the progs file if not already present.
 */
function addProgsEntry(progsPath: string): void {
    if (!fs.existsSync(progsPath)) {
        ExtensionOutputChannel.warn(
            'ServerSetup',
            `progs file not found at ${progsPath} — skipping entry`,
        );
        vscode.window.showWarningMessage(
            `Could not find WinCC OA progs file at ${progsPath}. Please add the manager entry manually.`,
        );
        return;
    }

    const content = fs.readFileSync(progsPath, 'utf8');
    if (content.includes(PROGS_ENTRY_MARKER)) {
        ExtensionOutputChannel.info('ServerSetup', 'progs entry already present — skipping');
        return;
    }

    const separator = content.endsWith('\n') ? '' : '\n';
    fs.writeFileSync(progsPath, content + separator + PROGS_ENTRY + '\n', 'utf8');
    ExtensionOutputChannel.info('ServerSetup', `progs entry added to ${progsPath}`);
}

/**
 * Spawns a child process and streams stdout/stderr to the extension output channel.
 * Resolves on exit code 0, rejects with an error on non-zero exit or spawn error.
 */
function runCmd(
    cmd: string,
    args: string[],
    cwd: string,
    progress: vscode.Progress<{ message?: string }>,
    label: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        ExtensionOutputChannel.info(
            'ServerSetup',
            `Running: ${cmd} ${args.join(' ')}  (cwd: ${cwd})`,
        );
        progress.report({ message: label });

        const proc = spawn(cmd, args, {
            cwd,
            shell: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        proc.stdout?.on('data', (data: Buffer) => {
            ExtensionOutputChannel.info('ServerSetup', data.toString().trimEnd());
        });
        proc.stderr?.on('data', (data: Buffer) => {
            ExtensionOutputChannel.info('ServerSetup', data.toString().trimEnd());
        });

        proc.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`"${cmd} ${args.join(' ')}" exited with code ${code}`));
            }
        });

        proc.on('error', reject);
    });
}
