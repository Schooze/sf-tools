# Releasing SF-Tools

## Build Windows distributions

Use the toolchain described in [development](development.md). Fetch locked Cargo dependencies before the offline build.

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run check
npm run build:windows
npm run test:desktop
```

The packaging script builds the Tauri core, tests and builds the standalone launcher, and creates an NSIS installer using that launcher. Initial NSIS/plugin downloads require internet access. Bundler tools are cached under `src-tauri/target/.tauri/`.

The Windows packaging pipeline uses the GNU resource archive and requires the GNU target/MinGW toolchain. Do not distribute `src-tauri/target/release/sf-tools.exe`: it is the private unwrapped core restored by the script after bundling.

## Output

For application version 0.2.1:

| Path under `artifacts/windows/`        | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| `SF-Tools-0.2.1-windows-x64.exe`       | Single-file portable application               |
| `SF-Tools-0.2.1-windows-x64-setup.exe` | NSIS installer                                 |
| `SHA256SUMS.txt`                       | Checksums for both distributable files         |
| `validation/packaging.json`            | Version and embedded payload identity          |
| `validation/validation.json`           | Production executable simulator self-test      |
| `validation/portable-validation.json`  | Cold cache, moved EXE, and cache repair checks |
| `validation/desktop-validation.json`   | Native WebView simulator UI smoke test         |
| `validation/desktop-smoke.png`         | Smoke-test screenshot                          |

Names derive from `package.json`. Keep the package, Cargo, Tauri, and application display versions synchronized when releasing.

## Validation

`npm run build:windows` runs the launcher unit tests and production portable tests. Portable validation copies only the public EXE into a new folder, uses an initially empty runtime cache, repeats after moving it, and checks repair of a corrupt cached loader. It also verifies that the public PE imports do not require an adjacent WebView2Loader DLL.

`npm run test:desktop` launches a dedicated native application instance with an isolated profile and local debugging port. It connects SIMULATOR through UI controls, opens Motion Control, checks the displayed application version, captures a screenshot, and closes that instance. It requires an interactive Windows session with WebView2 Runtime.

The production self-test exercises the simulator through the real session worker: handshake, disabled startup, configuration, telemetry, commissioning, PVT, and E-STOP. This does not open a physical COM port or move a motor.

A successful build is not a completed installer installation test or a hardware test. Record those separately with the actual environment and results.

## Publish

1. Inspect the changes, version, changelog, and validation reports.
2. Verify checksums against the generated EXE and installer.
3. Create a Git tag and GitHub Release for the reviewed version.
4. Upload the portable EXE, installer, and `SHA256SUMS.txt` as release assets.
5. Summarize tested environments and known firmware limitations in the release notes.

Generated binaries and reports are ignored by Git. Do not commit the output directory or publish local cache/archive contents. Publishing, tagging, and pushing are deliberate maintainer actions; the local build does not perform them.

The application license remains undecided. Preserve upstream and dependency notices when publishing.
