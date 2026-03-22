# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
