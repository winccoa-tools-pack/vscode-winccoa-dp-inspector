# WinCC OA DP Inspector

<div align="center">

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-1.109.2-007ACC.svg)

**Live datapoint inspector for WinCC OA — subscribe to datapoints, watch values update in real-time, and visualize them as charts inside VS Code**

[Features](#-features) • [Installation](#-installation) • [Known Issues](#-known-issues)

</div>

---

> **Latest Update (v0.2.0):** Auto-Setup wizard with PMON integration — the server manager is installed and started at runtime without a project restart. See [CHANGELOG](CHANGELOG.md) for details.
>
> **Tip:** If the extension doesn't work as expected, try `Ctrl+Shift+P` → `Reload Window` to refresh.

---

## 🎬 See It In Action

<!-- GIF coming soon -->

---

## ✨ Features

### 📡 Live DP Monitoring

- **Real-time subscriptions**: Subscribe to any datapoint element and watch values update instantly
- **Wildcard search**: Search across all datapoints using WinCC OA patterns (e.g. `System1:Pump*`)
- **Multiple subscriptions**: Monitor multiple datapoints simultaneously in a single panel

### 📈 Charts

- **Time-series visualization**: Numeric DP values are rendered as live charts
- **Multiple series**: Compare several datapoints in one chart view

### 🧙 Auto-Setup Wizard

- **One-Click Installation**: Automatically clones, builds, and registers the required Node.js server
- **PMON Integration**: Server manager is added at runtime via PMON — **no project restart required**
- **Rebuild / Update**: Pull latest server changes and rebuild with a single command
- **Status Check**: View installation status and manager entry at any time

---

## ⚙️ Configuration

### Essential Settings

| Setting | Default | Description |
| --- | --- | --- |
| `winccoa.dpInspector.host` | `localhost` | WebSocket server hostname |
| `winccoa.dpInspector.port` | `4712` | WebSocket server port |
| `winccoa.dpInspector.server.repoUrl` | GitHub URL | Git repository to clone for setup |
| `winccoa.dpInspector.server.branch` | `feature/dp-inspector-0.1.0` | Branch to clone/pull during setup or rebuild |

💡 **Tip**: Use `winccoa.dpInspector.server.branch` to pin to a specific server version.

---

## 🐛 Known Issues

### Current Limitations

1. **Branch Setting Default**:
    - Default branch is `feature/dp-inspector-0.1.0` (not `main`) — the server repository has not yet had a stable release
    - Status: Will be updated once a stable release is published

2. **File Re-Activation After Rebuild**:
    - If the server is rebuilt while the DP Inspector panel is open, the WebSocket connection may drop and not auto-reconnect
    - Workaround: Close and reopen the DP Inspector panel after a rebuild

3. **Wildcard Performance**:
    - Very broad patterns (e.g. `*`) on large projects may return thousands of results and slow down the UI
    - Recommendation: Use system-prefixed patterns like `System1:Pump*` for better performance

### Reporting Bugs

Found an issue? Please report it with:

- WinCC OA version
- Extension version (`0.2.0`)
- Steps to reproduce
- Output from the extension output channel (`WinCC OA DP Inspector`)

[Report Issue on GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-dp-inspector/issues)

---

## 📝 Commands

Access via `Ctrl+Shift+P`:

| Command | Description |
| --- | --- |
| `WinCC OA: Open DP Inspector` | Opens the DP Inspector panel (with auto-setup prompt if needed) |
| `WinCC OA: DP Inspector - Setup Server` | Full setup: clone → build → register manager via PMON |
| `WinCC OA: DP Inspector - Rebuild / Update Server` | Pull latest changes and rebuild the server |
| `WinCC OA: DP Inspector - Show Server Status` | Shows installation status and WinCC OA manager entry |

---

## 🏗️ Architecture

```
WinCC OA Runtime
  └── Node.js Manager  (javascript/dpInspectorServer/dist/index.js)
        └── WebSocket Server :4712
              ↕  JSON protocol
VS Code Extension
  └── DP Inspector Webview (React + Vite)
```

The server runs as a WinCC OA JavaScript Manager with full access to the runtime API (`dpConnect`, `dpNames`, `dpElementType`). The extension connects via WebSocket and renders live values in a Webview panel.

---

## 🛠️ Requirements

- **VS Code:** 1.109.2 or higher
- **WinCC OA:** 3.19+ (running project with JavaScript Manager support)
- **Node.js:** 14+ (for the dp-inspector-server runtime)
- **WinCC OA Project Admin Extension:** Required for automatic project detection and PMON integration

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 📜 Disclaimer

WinCC OA and Siemens are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project.

---

<div align="center">

Made with ❤️ for the WinCC OA community

[GitHub](https://github.com/winccoa-tools-pack/vscode-winccoa-dp-inspector) • [Issues](https://github.com/winccoa-tools-pack/vscode-winccoa-dp-inspector/issues) • [WinCC OA Docs](https://www.winccoa.com)

</div>
