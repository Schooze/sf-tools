# Architecture

## Device path

The React interface uses Zustand stores and an SFBridge interface. The desktop bridge invokes Tauri commands, which send work to a serialized Rust session worker.

The worker owns one transport and one selected node. It parses continuous serial input into frames, matches responses by node and register, and routes telemetry and events separately. Only one normal request is active at a time. Timeouts and port failures are surfaced to the interface.

The explicit simulator uses the same frame protocol and register catalog. Selecting a serial port never falls back to simulation.

## Shared contract

[registers.json](../shared/registers.json) supplies register definitions, control modes, events, and configuration metadata to Rust and TypeScript. Pinned firmware snapshots in [shared/firmware](../shared/firmware) provide test fixtures and provenance.

Configuration tracks active values, staged settings, and unsaved edits. Apply writes changed fields and verifies readback. Save to flash and reset remain separate device operations.

Commissioning waits for completion events before reading results or advancing. Movement cancellation invalidates queued commands; E-STOP prioritizes disable before PVT stop.

## Windows packaging

The Tauri core links against WebView2Loader. The public executable is a small Rust launcher with the core and loader embedded as payloads.

On startup, it verifies those bytes in `%LOCALAPPDATA%/SF-Tools/runtime/<version>-<payload-id>/`, repairs missing or incomplete components, launches the private core, and forwards arguments and exit status. The NSIS installer packages that same public executable.

The loader is bundled; the Microsoft WebView2 Runtime remains a system prerequisite. Packaging details and validation commands are in [releasing](releasing.md).
