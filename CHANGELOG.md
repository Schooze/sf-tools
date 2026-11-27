# Changelog

## 0.2.1 — 2026-11-27

- Package the Windows core and WebView2 loader inside one portable EXE.
- Use the same standalone executable for installed and portable distributions.
- Verify and repair cached components automatically.
- Add portable relocation, cache repair, and native simulator UI smoke validation.
- Organize source, branding, documentation, tests, and ignored build artifacts for GitHub.
- Add formatting checks, Windows CI, contribution templates, and release instructions.
- Update compatible Vite 6 and transitive build dependency patches.

## 0.2.0 — 2026-11-27

- Align the application with SF-Motion firmware 0.3.0 at commit 2e58c941.
- Add real USB serial sessions, frame parsing, register operations, node selection, and event routing.
- Share the register catalog across Rust, TypeScript, and the explicit simulator.
- Expand motor configuration with readback-verified Apply and separate flash persistence.
- Add motion modes, S-curve/PVT control, sequential commissioning, cogging acquisition, and E-STOP priority.
- Replace generated readings and fake acknowledgments with device telemetry, events, and transport diagnostics.
- Provide real firmware version information and ST-Link update guidance.
