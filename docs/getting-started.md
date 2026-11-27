# Getting started

## Install SF-Tools

Run `SF-Tools-0.2.1-windows-x64-setup.exe` and follow the installer. It checks for WebView2 Runtime and downloads it if missing, so an initial runtime installation requires internet access.

Alternatively, copy `SF-Tools-0.2.1-windows-x64.exe` anywhere, including the Desktop. The portable file prepares its embedded components in the current user's application-data cache. You do not need a DLL beside the EXE. The system WebView2 Runtime is still required.

Both distributions use the same application entry point. The portable build is separate from the private engine under `src-tauri/target/`, which is an intermediate build artifact.

## Connect

1. Attach the controller through USB serial.
2. Select the COM port, baud rate (default 115200), and node (default 0).
3. Connect. SF-Tools checks firmware version and node identity before showing a connected state.
4. For a hardware-free session, select **SIMULATOR** explicitly.

One node is selected at a time. Switching nodes stops the old subscriptions, clears displayed measurements, and loads the new configuration. Switching is unavailable during commissioning or PVT upload.

The browser preview displays the interface; device and simulator operations require the desktop application.

## Configure

1. Read the actual device configuration after connecting.
2. Edit parameters or import a profile.
3. Use **Apply to device** to write only changed parameters and verify them by reading back. Failed fields remain marked as changed.
4. Use **Save to flash** separately for persistence.
5. Follow the save/restart notes for staged parameters such as node ID and encoder configuration.

Profile import does not apply values to hardware. Legacy profiles are migrated only where meanings are known; skipped parameters are reported.

**Restore defaults** disables output and PVT first, sends the firmware defaults command, and returns to node 0. Saving those defaults to flash remains a separate action.

## Control and commission

In Motion Control, select a supported mode and use **Enable selected mode** explicitly. Connect does not enable the motor. Position uses degrees, speed uses RPM, and electrical angle uses radians.

Commissioning requires **Enable output for commissioning** in the current session. Measurements wait for firmware completion events. A timeout leaves completion unconfirmed and stops the sequence.

PVT CSV files use the header `position_deg,velocity_deg_s`. Upload appends points to the firmware buffer. Run and Stop are separate operations. **Stop does not clear the buffer.**

**E-STOP** cancels pending movement commands, prioritizes motor disable through register 102, then stops PVT through register 104. The displayed result follows device responses. Firmware has no commissioning-abort register, so disabling output does not prove its internal measurement routine has stopped.

Read the [firmware limitations](firmware-compatibility.md) before interpreting device results.
