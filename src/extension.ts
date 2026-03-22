/**
 * @fileoverview Main extension entry point for WinCC OA VS Code extensions.
 *
 * This file serves as a template/example for building WinCC OA VS Code extensions.
 * It demonstrates:
 * - Basic extension activation and deactivation
 * - Integration with dependent extensions (WinCC OA Project Admin)
 * - Configuration handling
 * - Command registration
 * - Logging setup
 *
 * Key concepts shown:
 * - Extension lifecycle management
 * - Safe dependency handling with activation waiting
 * - Project change event subscription
 * - Configuration change watching
 * - Proper cleanup on deactivation
 *
 * @example
 * ```typescript
 * // Basic extension structure
 * export async function activate(context: vscode.ExtensionContext) {
 *     // Initialize logging
 *     const outputChannel = ExtensionOutputChannel.initialize();
 *     context.subscriptions.push(outputChannel);
 *
 *     // Setup dependent extension integration
 *     await setupCoreExtensionIntegration(context);
 *
 *     // Register commands
 *     const command = vscode.commands.registerCommand('myExtension.command', handler);
 *     context.subscriptions.push(command);
 * }
 *
 * export function deactivate() {
 *     // Cleanup resources
 * }
 * ```
 */

// src/extension.ts
import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput';
import { EXTENSION_CONFIG_SECTION, EXTENSION_ID, EXTENSION_NAME } from './const';
import { setupCoreExtensionIntegration, cleanupCoreExtensionIntegration } from './otherExtensions';
import { DpInspectorPanel } from './dpInspectorPanel';
import { checkServerStatus, runSetup, runRebuild, addProgsEntryForProject } from './serverSetup';
import { getCurrentProjectInfo } from './otherExtensions';

/**
 * Interface representing a WinCC OA project.
 *
 * This matches the project structure provided by the WinCC OA Project Admin extension.
 * Used when subscribing to project change events.
 */

/**
 * Extension activation function - called when VS Code activates the extension.
 *
 * This function sets up the extension's core functionality:
 * 1. Initializes logging infrastructure
 * 2. Sets up integration with dependent extensions
 * 3. Registers configuration watchers
 * 4. Registers commands
 *
 * @param context - VS Code extension context for managing subscriptions and state
 *
 * @example
 * ```typescript
 * // VS Code calls this automatically when the extension activates
 * export async function activate(context: vscode.ExtensionContext) {
 *     // Your setup code here
 * }
 * ```
 */
export async function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    const outputChannel = ExtensionOutputChannel.initialize();
    context.subscriptions.push(outputChannel);

    ExtensionOutputChannel.info('Extension', `${EXTENSION_NAME} (${EXTENSION_ID}) activated`);
    ExtensionOutputChannel.info('Extension', `Extension Path: ${context.extensionPath}`);
    ExtensionOutputChannel.debug('Extension', `VS Code Version: ${vscode.version}`);

    // Setup Core extension integration (provides active WinCC OA project info)
    await setupCoreExtensionIntegration(context);

    // Watch for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(`${EXTENSION_CONFIG_SECTION}.logLevel`)) {
                ExtensionOutputChannel.updateLogLevel();
            }
            if (e.affectsConfiguration(`${EXTENSION_CONFIG_SECTION}.pathSource`)) {
                void setupCoreExtensionIntegration(context);
            }
            // Forward host/port changes to an open panel
            if (
                e.affectsConfiguration(`${EXTENSION_CONFIG_SECTION}.host`) ||
                e.affectsConfiguration(`${EXTENSION_CONFIG_SECTION}.port`)
            ) {
                const cfg = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION);
                const host = cfg.get<string>('host', 'localhost');
                const port = cfg.get<number>('port', 4712);
                if (DpInspectorPanel.currentPanel) {
                    DpInspectorPanel.currentPanel.sendConfigChanged(host, port);
                }
            }
        }),
    );

    // Register the "Open DP Inspector" command
    const openCommand = vscode.commands.registerCommand('winccoa.dpInspector.open', async () => {
        ExtensionOutputChannel.info('Extension', 'Opening DP Inspector panel');

        // ── 1. Require an active project ─────────────────────────────────────
        const project = getCurrentProjectInfo();
        if (!project?.projectDir) {
            vscode.window.showErrorMessage(
                'No active WinCC OA project found. Please select a project in the Project Admin panel first.',
            );
            return;
        }
        const projectPath = project.projectDir;

        const status = checkServerStatus(projectPath);

        // ── 2. Server not installed → offer full setup ────────────────────────
        if (!status.isInstalled) {
            const answer = await vscode.window.showInformationMessage(
                'DP Inspector Server is not installed for this project. Run auto-setup now?',
                'Run Setup',
                'Cancel',
            );
            if (answer !== 'Run Setup') {
                return;
            }
            try {
                await runSetup(project);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                ExtensionOutputChannel.error('Extension', `Setup failed: ${msg}`);
                vscode.window.showErrorMessage(`DP Inspector Server setup failed: ${msg}`);
                return;
            }
            // Open panel after successful setup
            DpInspectorPanel.createOrShow(context);
            return;
        }

        // ── 3. Installed but no progs entry → offer to add it ────────────────
        if (!status.hasProgsEntry) {
            const answer = await vscode.window.showWarningMessage(
                'DP Inspector Server is installed but has no manager entry in the progs file. Add it now?',
                'Add Entry',
                'Open Anyway',
                'Cancel',
            );
            if (answer === 'Cancel' || answer === undefined) {
                return;
            }
            if (answer === 'Add Entry') {
                try {
                    addProgsEntryForProject(projectPath);
                    vscode.window.showInformationMessage(
                        'Manager entry added to progs. Restart the WinCC OA project to start the server.',
                    );
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    ExtensionOutputChannel.error('Extension', `Failed to add progs entry: ${msg}`);
                    vscode.window.showErrorMessage(`Failed to add progs entry: ${msg}`);
                    return;
                }
            }
            // answer === 'Open Anyway' → fall through
        }

        // ── 4. All good (or user chose Open Anyway) → open panel ─────────────
        DpInspectorPanel.createOrShow(context);
    });

    // ── Setup command ─────────────────────────────────────────────────────────
    const setupCommand = vscode.commands.registerCommand('winccoa.dpInspector.setup', async () => {
        ExtensionOutputChannel.info('Extension', 'Running server setup');

        const project = getCurrentProjectInfo();
        if (!project?.projectDir) {
            vscode.window.showErrorMessage(
                'No active WinCC OA project found. Please select a project in the Project Admin panel first.',
            );
            return;
        }

        const status = checkServerStatus(project.projectDir);
        if (status.isInstalled) {
            const answer = await vscode.window.showWarningMessage(
                `DP Inspector Server is already installed at ${status.serverPath}. Re-install?`,
                'Re-install',
                'Cancel',
            );
            if (answer !== 'Re-install') {
                return;
            }
        }

        try {
            await runSetup(project);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            ExtensionOutputChannel.error('Extension', `Setup failed: ${msg}`);
            vscode.window.showErrorMessage(`DP Inspector Server setup failed: ${msg}`);
        }
    });

    // ── Rebuild command ───────────────────────────────────────────────────────
    const rebuildCommand = vscode.commands.registerCommand(
        'winccoa.dpInspector.rebuild',
        async () => {
            ExtensionOutputChannel.info('Extension', 'Running server rebuild');

            const project = getCurrentProjectInfo();
            if (!project?.projectDir) {
                vscode.window.showErrorMessage(
                    'No active WinCC OA project found. Please select a project in the Project Admin panel first.',
                );
                return;
            }

            try {
                await runRebuild(project);
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                ExtensionOutputChannel.error('Extension', `Rebuild failed: ${msg}`);
                vscode.window.showErrorMessage(`DP Inspector Server rebuild failed: ${msg}`);
            }
        },
    );

    // ── Status command ────────────────────────────────────────────────────────
    const statusCommand = vscode.commands.registerCommand(
        'winccoa.dpInspector.serverStatus',
        async () => {
            const project = getCurrentProjectInfo();
            if (!project?.projectDir) {
                vscode.window.showErrorMessage(
                    'No active WinCC OA project found. Please select a project in the Project Admin panel first.',
                );
                return;
            }

            const status = checkServerStatus(project.projectDir);
            const lines = [
                `Project:      ${project.projectDir}`,
                `Installed:    ${status.isInstalled ? '✅ yes' : '❌ no'}`,
                `Progs entry:  ${status.hasProgsEntry ? '✅ yes' : '❌ no'}`,
                `Server path:  ${status.serverPath}`,
            ];
            vscode.window.showInformationMessage(lines.join('\n'), { modal: true });
        },
    );

    context.subscriptions.push(openCommand, setupCommand, rebuildCommand, statusCommand);
}

/**
 * Sets up integration with the WinCC OA Project Admin core extension.
 *
 * This function demonstrates best practices for handling dependent extensions:
 * - Checks if the dependent extension is installed
 * - Waits for the dependent extension to activate (with timeout)
 * - Falls back to manual activation if needed
 * - Subscribes to project change events
 * - Handles configuration-based enable/disable
 *
 * The integration supports two modes:
 * - 'automatic': Full integration with project detection
 * - Other values: Static mode (integration disabled)
 *
 * @param context - VS Code extension context for managing subscriptions
 * @returns Promise that resolves when setup is complete
 *
 * @example
 * ```typescript
 * // In your activate function:
 * await setupCoreExtensionIntegration(context);
 *
 * // The extension will now automatically:
 * // - Detect when WinCC OA projects change
 * // - Log project information
 * // - Adapt to the current project context
 * ```
 */

/**
 * Extension deactivation function - called when VS Code deactivates the extension.
 *
 * This function should clean up any resources that were allocated during activation:
 * - Unsubscribe from event listeners
 * - Clear timers/intervals
 * - Close connections
 * - Log deactivation
 *
 * Note: VS Code may call this function at any time, so it should be robust
 * and handle cases where resources may not be initialized.
 *
 * @example
 * ```typescript
 * export function deactivate() {
 *     // Clean up your resources here
 *     ExtensionOutputChannel.info('Extension', 'Extension deactivated');
 * }
 * ```
 */
export function deactivate() {
    ExtensionOutputChannel.info('Extension', `WinCC OA ${EXTENSION_NAME} Extension deactivated`);
    // Clean up core extension integration resources
    cleanupCoreExtensionIntegration();
}
