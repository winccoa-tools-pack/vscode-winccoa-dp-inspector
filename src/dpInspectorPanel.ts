import * as vscode from 'vscode';
import { ExtensionOutputChannel } from './extensionOutput';
import { EXTENSION_CONFIG_SECTION } from './const';

/** Persisted state key in workspaceState. */
const STATE_KEY = 'dpInspectorState';

/**
 * Manages the DP Inspector WebviewPanel.
 *
 * Follows the same singleton factory pattern as LogViewerPanel in
 * vscode-winccoa-logviewer: `createOrShow` either reveals an existing panel
 * or creates a fresh one using the built React/Vite webview bundle.
 */
export class DpInspectorPanel {
    public static currentPanel: DpInspectorPanel | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _context: vscode.ExtensionContext;
    private readonly _disposables: vscode.Disposable[] = [];

    // ─── Factory ─────────────────────────────────────────────────────────────

    public static createOrShow(context: vscode.ExtensionContext): void {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;

        if (DpInspectorPanel.currentPanel) {
            ExtensionOutputChannel.debug('DpInspectorPanel', 'Revealing existing panel');
            DpInspectorPanel.currentPanel._panel.reveal(column);
            return;
        }

        ExtensionOutputChannel.info('DpInspectorPanel', 'Creating new panel');

        const panel = vscode.window.createWebviewPanel(
            'winccoaDpInspector',
            'DP Inspector',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview'),
                ],
            },
        );

        DpInspectorPanel.currentPanel = new DpInspectorPanel(panel, context);
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        this._panel = panel;
        this._context = context;
        this._extensionUri = context.extensionUri;

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message: { command: string; [key: string]: unknown }) => {
                ExtensionOutputChannel.trace(
                    'DpInspectorPanel',
                    `Received message: ${message.command}`,
                );
                switch (message.command) {
                    case 'ready':
                        this._onWebviewReady();
                        return;

                    case 'saveState':
                        this._saveState(message['state']);
                        return;

                    case 'openSettings':
                        vscode.commands.executeCommand(
                            'workbench.action.openSettings',
                            EXTENSION_CONFIG_SECTION,
                        );
                        return;
                }
            },
            null,
            this._disposables,
        );
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Notify the webview that VS Code configuration changed.
     * Called by the extension host when `winccoa.dpInspector.*` settings change.
     */
    public sendConfigChanged(host: string, port: number): void {
        this._panel.webview.postMessage({ command: 'configChanged', host, port });
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private _onWebviewReady(): void {
        ExtensionOutputChannel.info('DpInspectorPanel', 'Webview ready — sending init state');

        const config = vscode.workspace.getConfiguration(EXTENSION_CONFIG_SECTION);
        const host = config.get<string>('host', 'localhost');
        const port = config.get<number>('port', 4712);

        const persistedState = this._context.workspaceState.get(STATE_KEY) ?? null;

        this._panel.webview.postMessage({
            command: 'initState',
            host,
            port,
            persistedState,
        });
    }

    private _saveState(state: unknown): void {
        this._context.workspaceState.update(STATE_KEY, state);
        ExtensionOutputChannel.trace('DpInspectorPanel', 'State persisted to workspaceState');
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const webviewRoot = vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview');
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(webviewRoot, 'index.css'));

        // CSP: allow ws:// connections to localhost for the WebSocket client in the webview
        const csp = [
            "default-src 'none';",
            `img-src ${webview.cspSource} data:;`,
            `style-src ${webview.cspSource} 'unsafe-inline';`,
            `script-src ${webview.cspSource};`,
            // WebSocket connections to any local port (the inspector server)
            `connect-src ws://localhost:* ws://127.0.0.1:* wss://localhost:* wss://127.0.0.1:*;`,
        ].join(' ');

        return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WinCC OA DP Inspector</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose(): void {
        ExtensionOutputChannel.info('DpInspectorPanel', 'Disposing panel');
        DpInspectorPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const d = this._disposables.pop();
            if (d) d.dispose();
        }
    }
}
