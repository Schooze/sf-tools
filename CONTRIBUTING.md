# Contributing

Start with the [development guide](docs/development.md) and [firmware compatibility notes](docs/firmware-compatibility.md).

## Report an issue

Include the SF-Tools version, Windows version, firmware revision, transport, selected node, and steps to reproduce. State whether the issue occurs on physical hardware or the explicit simulator. For connection issues, include relevant terminal/device events after removing private information.

## Propose a change

Keep changes focused. Describe the trigger, resulting behavior, and any affected firmware registers. Update the catalog, simulator, tests, and documentation together when the protocol contract changes.

Before submitting:

```powershell
npm ci
cargo fetch --locked --manifest-path src-tauri/Cargo.toml
npm run check
```

For Windows packaging changes, also run `npm run build:windows` and `npm run test:desktop`. Report actual validation and any unavailable checks. Do not claim hardware testing from simulator results.

Use `npm run format` for maintained files. Keep lockfiles committed and generated binaries, caches, and reports out of source commits. Leave pinned upstream snapshots unchanged unless intentionally updating the supported firmware reference.

## License status

An application license has not yet been selected. Do not add or change an application license without a maintainer decision. Existing upstream and third-party license notices must be preserved.
