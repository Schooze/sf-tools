# Third-party notices

## SF-Motion reference snapshots

The files in [shared/firmware](shared/firmware) are reference snapshots from [SF-Motion commit 2e58c941620b2fbd82c751d390fcecee27f16ece](https://github.com/sirojudinMunir/sf-motion/commit/2e58c941620b2fbd82c751d390fcecee27f16ece).

Copyright (c) 2026 sirojudin munir. Their upstream MIT license is retained in [shared/firmware/LICENSE](shared/firmware/LICENSE).

## Dependencies and Windows runtime

JavaScript and Rust dependencies are recorded in [package-lock.json](package-lock.json) and [src-tauri/Cargo.lock](src-tauri/Cargo.lock). Each dependency retains its own license and notices; those licenses do not select an application license for SF-Tools.

Windows packaging obtains WebView2Loader from the exact `webview2-com-sys` version in Cargo.lock. The Microsoft loader and WebView2 Runtime remain subject to their applicable Microsoft distribution terms, separate from the Rust bindings. Preserve accompanying upstream notices when distributing dependencies.

## Application license

The SF-Tools application license is not yet determined. This file records third-party provenance and does not grant an application license.
