# SF-Tools 0.2.0 — validation

Date: 27 November 2026 (Asia/Jakarta)

Firmware protocol baseline: SF-Motion 0.3.0, commit 2e58c941620b2fbd82c751d390fcecee27f16ece.

## Passed

- npm test: 9 tests (configuration/profile/PVT/telemetry models and static rendering of every screen).
- npm run test:rust: 23 tests (core compiled without desktop GUI dependencies).
- TypeScript/Vite production build.
- Tauri Windows x64 release build and NSIS installer generation.
- Production portable executable --self-test: exit 0, ok:true. The exact machine-readable result is in validation.json.
- SHA-256 verification of sf-tools.exe, WebView2Loader.dll and SF-Tools-Setup.exe against SHA256SUMS.txt.
- Windows product version for the portable executable and installer: 0.2.0.

The production self-test uses the framed simulator transport, including firmware handshake, disabled start, configuration, telemetry, explicit motor enable, commissioning completion events, PVT and E-STOP. It does not open a hardware COM port.

## Not verified

- Physical controller communication, motor motion, protection response and calibration accuracy.
- Interactive desktop UI flow: Computer Use was stopped by the user with Escape. Static rendering tests are not an interactive or visual UI test.
- Installing the generated installer onto the user's system. The installer was built successfully; it was not installed as part of verification.

## Build environment notes

The Windows GNU linker emitted a multiple-manifest merge warning; the resulting production executable loaded and passed its native self-test. Core Rust tests avoid the GUI Common Controls activation context that prevented the default GUI-linked test executable from loading on this host.

NSIS 3.11 and nsis_tauri_utils 0.5.3 were obtained from official Tauri release URLs and checked against the upstream SHA-1 hashes before packaging. The NSIS compiler had to run outside the execution sandbox because its 32-bit runtime hit DLL relocation error 623 inside it.

Keep WebView2Loader.dll beside the portable executable. Use the installer for normal installation. See README.md for firmware limitations, especially staged settings, finite cogging LUT acquisition, PVT buffer semantics and the absence of USB flashing / fault-clear / temperature endpoints.
