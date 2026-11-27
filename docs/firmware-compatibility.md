# Firmware compatibility

SF-Tools 0.2.1 targets **SF-Motion 0.3.0**, [commit 2e58c941620b2fbd82c751d390fcecee27f16ece](https://github.com/sirojudinMunir/sf-motion/commit/2e58c941620b2fbd82c751d390fcecee27f16ece), dated 21 November 2026. Older protocols are not supported.

## Feature matrix

| Firmware feature                                          | SF-Tools support                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------- |
| Firmware version and node identity                        | Version handshake and matching response node                          |
| Register reads and writes                                 | Shared catalog, type checks, ACK handling, readback verification      |
| Motor and PID parameters                                  | Grouped configuration, Apply, Revert, profiles                        |
| FOC sensored / SMO+HFI / SMO+HFI New / Hybrid             | Firmware enum mapping                                                 |
| Disable / Torque / Speed / Position / Impedance / Voltage | Motion Control and terminal                                           |
| Motor enable and disable                                  | Explicit enable; prioritized E-STOP                                   |
| Impedance and current feedforward                         | Parameters and position, speed, and current references                |
| Field weakening and MTPA                                  | Configuration exposed by firmware registers                           |
| Current/voltage sensing and encoder PLL                   | Register configuration with activation notes                          |
| S-curve trajectory                                        | Position target and velocity, acceleration, jerk limits               |
| PVT                                                       | Point editor, CSV, append upload, run, stop, partial-upload reporting |
| Rs, Ld, Lq, encoder, pole pairs                           | Commissioning that waits for completion events                        |
| Cogging and anti-cogging                                  | Measurement, 1024-sample LUT acquisition, CSV, compensation enable    |
| I²t, under-voltage, over-voltage protection               | Parameters and received event history                                 |
| Telemetry streaming                                       | Up to 10 channels per node, plotter, CSV                              |
| Save, defaults, reset                                     | Real firmware operations; reset reported as sent                      |
| Firmware updates                                          | Real version information and ST-Link/PlatformIO guidance              |
| Audio, USB flashing, clear-fault, temperature             | No active device feature exposed                                      |

One active node is supported over direct USB or the firmware USB-to-CAN bridge. Third-party CAN adapters and simultaneous multi-motor control are outside this release.

## Protocol

USB frames use `A5 A5 | length | type | node | register | data` with little-endian numeric values. There is **no CRC or checksum**. Write responses contain an int8 status: zero succeeds and a negative value fails.

The [shared catalog](../shared/registers.json) is consumed by Rust, TypeScript, the simulator, and protocol reference. [Pinned upstream files](../shared/firmware) retain their commit reference and license. Register 1 (three-byte version) and register 103 (PVT float32 + int16) are supplemented from the C handler because they are missing from the upstream JSON.

Responses, telemetry, and events are separate. A response timeout closes the session to prevent a late response from being mistaken for the next request. Reconnection is explicit.

## Configuration and control

- Mode values are 0 Disable, 1 Torque, 2 Speed, 3 Position, 4 Impedance, 5 Audio, and 6 Voltage. Audio has no active control path in this firmware and cannot be selected.
- PWM register 21 stores a setting. This firmware build still uses an effective compile-time frequency of **40 kHz**, despite the stored default of 20 kHz.
- Node ID and certain encoder settings require save/restart. Register 2 may show a staged node ID; the response header identifies active routing.
- Phase-direction setter 90 changes storage, but Save overwrites it from the active direction. The editor shows it read-only. Pole-pair commissioning determines the active direction.
- Profile format 2 uses firmware register names. Format 1 explicitly migrates known parameters and legacy modes, reporting unsupported fields such as `max_rpm`.
- Firmware exposes no hardware revision, unique serial number, temperature, active-fault query, or clear-fault operation. Received event history does not enumerate every currently active fault.

## Motion and commissioning

- `move_done` is defined but is not reliably sent by these trajectory/PVT paths. An ACK or host timer is not treated as proof that motion completed.
- PVT holds 256 points at a 1 ms interval. Each point is `<float32 position_deg, int16 velocity_deg_s>`. Upload appends; Stop does not clear the buffer.
- There is no buffer occupancy/status query or clear-buffer command. Restart clears the volatile buffer. Run ACK does not prove that points were played.
- Commissioning waits for events after starting each operation. Events may be lost; a timeout means completion is unconfirmed. Failed sequences stop before the next step.
- There is no firmware commissioning-abort register. E-STOP disables output and cancels host waiting, but the internal firmware routine may remain active.
- Cogging channel 92 is a finite LUT acquisition rather than continuous telemetry. SF-Tools collects 1024 samples and restores normal subscriptions afterward.
- Automatic LUT output is available on direct USB. Through USB-to-CAN, measurement may complete while LUT acquisition is reported incomplete because samples were not forwarded.

## Telemetry and verification limits

Statistics and packet inspection reflect actual transport traffic. CSV includes the selected node and leaves unavailable or stale measurements empty. UI snapshots are approximately 60 Hz rather than a lossless recording of every firmware frame.

The simulator shares catalog, frames, channel limit, mode values, ACKs, commissioning events, and PVT buffer behavior. Its dynamics are approximate. Simulator tests do not establish physical controller performance.

Physical-device validation is separate from software, packaging, and simulator validation. Only claim hardware tests when they were actually performed.
