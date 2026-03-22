# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.2] - 2026-03-22

### Added

- collapsible live table, configurable buffer size (maxPoints) in settings
- keyboard nav + recently-added history + already-in-group indicator in AddDpDialog
- add clear chart data button, fix dot spacing in live table
- add server setup/rebuild commands with PMON integration and auto-setup on open
- lucide-react icons, pause button, DP visibility toggle, resize handle, dual Y-axis, CSS var theme fix
- migrate to Chart.js, new state shape, AddDpDialog, SettingsDrawer
- initial DP Inspector implementation

### Fixed

- markdownlint errors, add installation section, fix lint:md script to ignore webview/node_modules
- update server.branch default to main
- set manager startMode to once instead of always
- update DEFAULT_BRANCH to main
- stable X-axis ticks via snapped max boundary, pause button, lucide icons

### Changed

- prettier formatting
- add early prototype disclaimer to README
- update README + CHANGELOG, set extension to preview
- set publisher/author to RichardJansich, update icon path, settings toggle button

## [0.2.0] - 2026-03-22

### Added

- Auto-setup wizard on "Open DP Inspector": checks server status, installs via git clone + npm build + PMON manager registration
- `winccoa.dpInspector.setup` command — full server setup (clone → install → build → register)
- `winccoa.dpInspector.rebuild` command — pull latest changes and rebuild the server
- `winccoa.dpInspector.serverStatus` command — shows modal with install and progs entry status
- PMON live manager registration via `@winccoa-tools-pack/npm-winccoa-core` (no project restart needed)
- Fallback to direct progs file entry when PMON is unavailable
- Settings `winccoa.dpInspector.server.repoUrl` and `winccoa.dpInspector.server.branch` for custom server source
- `getCurrentProjectInfo()` helper using Project Admin API (`projectDir`, `id`, `version`)

## [0.1.0] - 2026-02-23

### Added

- Initial release: DP Inspector webview panel with live datapoint subscription
- WebSocket connection to dp-inspector-server on configurable host/port
- Wildcard DP search (`dpSearch` protocol)
- Subscribe/unsubscribe to datapoint elements
- Real-time value display and time-series charts
- Integration with WinCC OA Project Admin extension for project detection

## [Unreleased]
