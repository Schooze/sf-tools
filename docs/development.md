# Development

## Requirements

- Node.js 22 or newer and npm.
- Rust stable with the rustfmt component.
- Windows x64, Microsoft Edge WebView2 Runtime, and a compatible linker for native development.
- The release packaging script currently requires `x86_64-pc-windows-gnu` and MinGW because it links the GNU resource archive into the standalone launcher.

Install dependencies from the committed lockfiles:

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
```

Cargo test and production build scripts use the local dependency cache in offline mode. Populate it with the fetch command first.

## Run and check

```powershell
npm run prepare:runtime
npm run tauri dev
```

`npm run dev` is a browser-only preview. Use the Tauri application for actual serial communication or simulator operations.

```powershell
npm run check
```

The check command verifies formatting, frontend tests, TypeScript and production frontend build, and Rust core tests. Rust tests disable the desktop feature so their harness does not depend on a GUI activation context.

```powershell
npm run format
```

This formats maintained code and documentation. Vendored firmware snapshots, original branding assets, generated files, and historical plans are excluded.

## Repository layout

| Path                    | Purpose                                                         |
| ----------------------- | --------------------------------------------------------------- |
| `src/`                  | React interface, Zustand state, configuration model, and bridge |
| `src-tauri/src/`        | Rust commands, protocol, serial session, and simulator          |
| `src-tauri/icons/`      | Icons used by the Windows application                           |
| `shared/registers.json` | Shared register and event catalog                               |
| `shared/firmware/`      | Pinned upstream reference snapshots and their license           |
| `tests/frontend/`       | Configuration and rendered-view tests                           |
| `tests/desktop/`        | Native WebView simulator smoke test                             |
| `packaging/windows/`    | Standalone Windows launcher source                              |
| `scripts/`              | Build, packaging, runtime preparation, and portable validation  |
| `assets/branding/`      | Original logos and wordmarks                                    |
| `docs/`                 | Product and contributor documentation                           |
| `docs/archive/`         | Historical planning material                                    |
| `.github/`              | CI and contribution templates                                   |
| `artifacts/`            | Ignored builds, reports, caches, and local archives             |

Generated frontend output is `artifacts/frontend/`. Windows distributions and validation reports are under `artifacts/windows/`. Cargo and bundler intermediates remain under `src-tauri/target/`.

Local output from the previous folder layout is preserved under `artifacts/archive/` or `artifacts/test-cache/`. It is not part of the published source tree.

## Source references

The application catalog is verified against the pinned upstream JSON and C handler in tests. Do not format or modify those upstream snapshots to make catalog tests pass. Update the reference revision and catalog together when supporting a new firmware version.

See [architecture](architecture.md) for runtime responsibilities and [releasing](releasing.md) for production packaging.
