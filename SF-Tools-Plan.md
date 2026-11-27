# SF-Tools — Development Plan

## 1. Project Overview

**SF-Tools** adalah aplikasi desktop untuk melakukan konfigurasi, monitoring, diagnosis, dan maintenance perangkat embedded/robotics, dengan konsep fungsional mirip **VESC Tool**, tetapi menggunakan identitas, arsitektur, dan UX sendiri.

Target utama aplikasi:

- Konfigurasi parameter perangkat melalui koneksi fisik atau jaringan.
- Monitoring telemetry secara real-time.
- Menyimpan dan memuat profile konfigurasi.
- Firmware management.
- Diagnostic tools.
- Terminal/debug console.
- Device discovery dan connection management.
- UI sederhana, minimalis, clean, dan modern seperti aplikasi **Codex**.
- Dapat dibuild sebagai aplikasi Windows `.exe`.

SF-Tools sebaiknya dirancang sebagai **generic device configuration platform**, sehingga tidak terlalu tightly coupled terhadap satu board atau satu jenis firmware.

---

# 2. Product Principles

## 2.1 Simple First

SF-Tools tidak boleh mengikuti pola UI engineering tool lama yang penuh tombol, panel, graph, dan parameter dalam satu halaman.

Gunakan prinsip:

> Tampilkan hanya informasi yang diperlukan untuk task yang sedang dilakukan.

Contoh:

```text
Jangan:

Motor Config
├── 50 parameter
├── 10 tombol
├── 4 graph
└── telemetry

Lebih baik:

Motor Configuration
├── General
├── Limits
├── Control
├── Sensors
└── Advanced
```

---

## 2.2 Progressive Disclosure

Parameter yang jarang digunakan tidak langsung ditampilkan.

Contoh:

```text
Motor Current Limit
50 A

Input Voltage Limit
48 V

Control Mode
FOC

[ Advanced settings ]
```

Setelah `Advanced settings` dibuka:

```text
PWM Frequency
Observer Gain
Current Controller Kp
Current Controller Ki
...
```

---

## 2.3 Device State Always Visible

User harus selalu mengetahui:

```text
Connected / Disconnected
Device
Firmware
Transport
Port
Device ID
Warnings
```

Tanpa harus membuka halaman lain.

---

## 2.4 Safe Configuration

Setiap konfigurasi memiliki lifecycle:

```text
Device Value
     ↓
Local Edit
     ↓
Unsaved Changes
     ↓
Validate
     ↓
Write to Device
     ↓
Verify
```

SF-Tools tidak boleh langsung menulis setiap perubahan slider/input ke device tanpa mekanisme yang jelas.

---

# 3. Recommended Technology Stack

## Desktop Framework

```text
Tauri 2
```

Digunakan untuk:

- Windows desktop application.
- Native window.
- Serial communication.
- USB communication.
- TCP/UDP.
- File system.
- Firmware file management.
- Native dialogs.
- System information.
- Build `.exe`.

---

## Frontend

```text
React
TypeScript
Vite
Tailwind CSS
shadcn/ui
Radix UI
Lucide Icons
Motion
```

---

## State Management

```text
Zustand
```

Digunakan untuk:

- Connection state.
- Selected device.
- Configuration state.
- Unsaved changes.
- App settings.
- UI state.

---

## Server/Async State

```text
TanStack Query
```

Digunakan untuk operasi seperti:

- Read device config.
- Write config.
- Get firmware information.
- Device information query.
- Device capability discovery.

Untuk telemetry high-frequency, jangan mengandalkan TanStack Query.

Gunakan telemetry store tersendiri.

---

## Native Backend

```text
Rust
```

Digunakan untuk:

```text
Serial
USB
TCP
UDP
CAN adapter
Device protocol
Packet parsing
Firmware upload
CRC
Timeout
Retries
Logging
```

---

# 4. High-Level Architecture

```text
┌─────────────────────────────────────────────────────┐
│                     SF-Tools                        │
│                                                     │
│  React + TypeScript                                 │
│                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │ Dashboard  │ │ Config UI  │ │ Telemetry UI   │   │
│  └────────────┘ └────────────┘ └────────────────┘   │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │             Application State                │   │
│  │ Zustand / Telemetry Store / Device Store     │   │
│  └──────────────────────────────────────────────┘   │
│                       │                             │
│                   Tauri IPC                         │
│                       │                             │
├───────────────────────┼─────────────────────────────┤
│                       ▼                             │
│                   Rust Core                         │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │             Device Manager                   │   │
│  └──────────────────────────────────────────────┘   │
│          │               │              │           │
│          ▼               ▼              ▼           │
│       Serial            USB           TCP/UDP       │
│          │               │              │           │
│          └───────────────┴──────────────┘           │
│                          │                          │
│                          ▼                          │
│                  Protocol Layer                    │
│                          │                          │
│                          ▼                          │
│                     Hardware                       │
└─────────────────────────────────────────────────────┘
```

---

# 5. Core Architecture Rule

Pisahkan tiga layer berikut dengan tegas:

```text
Transport
Protocol
Device
```

## Transport

Transport hanya bertanggung jawab memindahkan byte.

```text
SerialTransport
TcpTransport
UdpTransport
UsbTransport
CanTransport
```

Interface konseptual:

```rust
trait Transport {
    fn connect(&mut self);
    fn disconnect(&mut self);
    fn write(&mut self, data: &[u8]);
    fn read(&mut self) -> Vec<u8>;
}
```

---

## Protocol

Protocol memahami packet.

Contoh:

```text
Header
Command
Payload Length
Payload
CRC
Footer
```

Protocol tidak peduli apakah packet datang dari:

```text
USB
UART
TCP
CAN
```

---

## Device

Device layer memahami semantic command.

Contoh:

```text
get_device_info()
read_motor_config()
write_motor_config()
read_telemetry()
reboot()
enter_bootloader()
update_firmware()
```

Arsitektur ini penting supaya SF-Tools dapat berkembang menjadi konfigurator banyak device.

---

# 6. Recommended UI Direction

## Visual Reference

Gunakan arah visual:

```text
Codex
Linear
Raycast
GitHub Desktop
Cursor
```

Bukan:

```text
Traditional industrial HMI
Old Qt desktop application
Windows Forms
VESC Tool clone
```

VESC Tool digunakan sebagai referensi **fitur**, bukan referensi visual.

---

# 7. Design System

## Color Palette

Dark mode menjadi default.

```text
Application Background
#171717

Sidebar
#1C1D1F

Elevated Surface
#202124

Hover Surface
#262729

Input Surface
#222325

Primary Text
#F2F2F2

Secondary Text
#A5A5A5

Muted Text
#6F6F6F

Border
rgba(255,255,255,0.07)
```

Accent color SF-Tools dapat ditentukan kemudian.

Gunakan accent hanya untuk:

```text
Selected state
Primary action
Graph highlight
Connection indicator
Important telemetry
```

Jangan menggunakan accent sebagai warna mayoritas UI.

---

## Radius

```text
Small controls     6 px
Buttons            8 px
Inputs             8 px
Cards             10 px
Dialogs           12 px
Large containers  14 px
```

---

## Typography

Rekomendasi:

```text
Inter
Geist
```

Hierarchy:

```text
Page title       22–24 px / 500
Section title    14–16 px / 500
Normal text      13–14 px / 400
Secondary text   12–13 px / 400
Telemetry        tabular numbers
```

Hindari terlalu banyak `font-bold`.

---

# 8. Main Application Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ File  Device  View  Tools  Help                         ─ □ X │
├──────────────────┬───────────────────────────────────────────┤
│                  │                                           │
│  SF-Tools        │                                           │
│                  │                                           │
│  Overview        │              Main Content                 │
│  Configuration   │                                           │
│  Telemetry       │                                           │
│  Diagnostics     │                                           │
│  Firmware        │                                           │
│  Terminal        │                                           │
│                  │                                           │
│                  │                                           │
├──────────────────┤                                           │
│ ● Connected      │                                           │
│ SF Controller    │                                           │
│ COM8             │                                           │
└──────────────────┴───────────────────────────────────────────┘
```

---

# 9. Sidebar

Sidebar utama:

```text
Overview

Configuration
  Motor
  Control
  Input
  Sensors
  Communication

Telemetry

Diagnostics

Firmware

Terminal

Settings
```

Sidebar harus dapat collapse.

Collapsed:

```text
[⌂]
[⚙]
[⌁]
[◉]
[⇧]
[>_]
```

---

# 10. Connection UX

Connection merupakan salah satu bagian paling penting.

Di bagian bawah sidebar:

```text
● Connected

SF Controller
COM8
```

Saat disconnected:

```text
○ No device

[ Connect ]
```

Klik `Connect` membuka connection popover/dialog.

---

# 11. Connection Manager

Contoh:

```text
Connect Device

Transport
[ Serial ▾ ]

Port
[ COM8 ▾ ]

Baud Rate
[ 115200 ▾ ]

Detected Device
SF-MotorController

[ Connect ]
```

Advanced:

```text
Auto reconnect      ON
Connection timeout  1000 ms
Packet timeout      100 ms
```

---

# 12. Device Discovery

Device discovery harus dibuat modular.

Target:

```text
Serial ports
USB devices
TCP devices
UDP broadcast devices
CAN adapters
```

Flow:

```text
Scan
 ↓
Transport Discovery
 ↓
Probe Device
 ↓
Read Device Info
 ↓
Display Compatible Device
```

---

# 13. Device Capability System

Jangan hard-code seluruh UI berdasarkan satu firmware.

Device mengirim capabilities.

Contoh:

```json
{
  "device": "SF-MotorController",
  "firmware": "1.3.0",
  "capabilities": [
    "motor_config",
    "telemetry",
    "imu",
    "firmware_update",
    "can"
  ]
}
```

UI kemudian menampilkan menu berdasarkan capability.

Contoh:

Device tanpa IMU:

```text
Motor
Telemetry
Firmware
```

Device dengan IMU:

```text
Motor
IMU
Telemetry
Firmware
```

---

# 14. Overview Page

Setelah device terhubung:

```text
SF Controller

Connected via COM8

Firmware
1.4.2

Hardware
SF-MC V2

Device ID
SFMC-0023

────────────────────────────

Status

Voltage       47.8 V
Current        2.1 A
Temperature   42 °C

No active warnings
```

Quick actions:

```text
[ Configure Device ]
[ Open Telemetry ]
[ Device Diagnostics ]
```

---

# 15. Configuration Page

Konfigurasi dibuat dalam bentuk section sederhana.

Contoh:

```text
Motor Configuration

General

Motor Type
[ BLDC        ▾ ]

Control Mode
[ FOC         ▾ ]

Pole Pairs
[ 7             ]

────────────────────

Limits

Max Current
[ 50 ] A

Max Voltage
[ 52 ] V

Max RPM
[ 10000 ] rpm
```

Footer sticky:

```text
3 unsaved changes

[ Discard ]          [ Write to Device ]
```

---

# 16. Configuration Schema

UI configuration sebaiknya schema-driven.

Contoh:

```json
{
  "key": "motor_current_max",
  "name": "Maximum Motor Current",
  "type": "float",
  "unit": "A",
  "min": 0,
  "max": 150,
  "default": 50,
  "category": "motor.limits"
}
```

Keuntungan:

```text
UI tidak hard-coded.
Firmware baru dapat menambah parameter.
Validation konsisten.
Profile config mudah dibuat.
```

---

# 17. Parameter Types

SF-Tools minimal mendukung:

```text
Integer
Float
Boolean
Enum
String
Slider
Range
IP address
MAC address
CAN ID
Bitmask
Color
File
Read-only value
```

---

# 18. Parameter State

Setiap parameter memiliki state:

```text
DEVICE
LOCAL
DEFAULT
```

Contoh:

```text
Max Current

Device:  40 A
Local:   50 A
Default: 30 A
```

UI normal cukup menampilkan:

```text
Max Current
[ 50 ] A    Modified
```

Detail dapat muncul lewat tooltip.

---

# 19. Configuration Actions

Wajib tersedia:

```text
Read from Device

Write to Device

Reset Section

Restore Defaults

Import Profile

Export Profile
```

---

# 20. Profiles

User dapat menyimpan konfigurasi.

Contoh:

```text
Profiles

Competition
Testing
Low Speed
High Torque
Default
```

Format:

```text
.sfconfig
```

Secara internal bisa menggunakan JSON.

Contoh:

```json
{
  "format": 1,
  "device": "SF-MotorController",
  "firmware": "1.4",
  "parameters": {
    "motor_current_max": 50,
    "control_mode": "foc"
  }
}
```

---

# 21. Telemetry Page

Telemetry harus real-time tetapi tetap minimalis.

Contoh:

```text
Telemetry

Voltage        48.2 V
Current        12.4 A
Power           598 W
RPM            3420
Temperature      44 °C

────────────────────────────────

Current
         ╭───────╮
─────────╯       ╰──────────────

────────────────────────────────

[ + Add Signal ]
```

Jangan langsung menampilkan 8 graph.

User memilih signal.

---

# 22. Telemetry Signal System

Signal registry:

```text
motor.current
motor.voltage
motor.rpm
motor.temperature
motor.duty_cycle
input.throttle
imu.accel_x
imu.gyro_z
```

Setiap signal:

```json
{
  "id": "motor.current",
  "name": "Motor Current",
  "unit": "A",
  "data_type": "float"
}
```

---

# 23. Telemetry Pipeline

Jangan mengirim telemetry high-frequency melalui React state per sample.

Gunakan:

```text
Device
  ↓
Rust Reader Thread
  ↓
Packet Parser
  ↓
Telemetry Buffer
  ↓
Rate Limiter
  ↓
Tauri Event
  ↓
Frontend Telemetry Store
  ↓
Graph
```

Misalnya:

```text
Device sampling  : 1000 Hz
Frontend update  : 30–60 Hz
Graph rendering  : 30–60 FPS
```

---

# 24. Graph System

Graph harus mendukung:

```text
Pause
Resume
Autoscale
Manual scale
Select signals
Clear
Record
Cursor
Zoom
```

Target awal:

```text
2–4 signal per graph
```

Hindari plotting seluruh telemetry sekaligus.

---

# 25. Data Recording

Tambahkan fitur:

```text
Start Recording
Stop Recording
```

Export:

```text
CSV
JSON
```

Future:

```text
Parquet
MCAP
```

---

# 26. Diagnostics

Halaman:

```text
Diagnostics
```

Sections:

```text
Communication
Sensors
Motor
Power
CAN
System
```

Contoh:

```text
Communication

Packets RX        12,481
Packets TX         8,912
CRC Errors             0
Timeouts               2

Connection Quality
Good
```

---

# 27. Fault System

Fault memiliki struktur:

```text
Severity
Code
Timestamp
Description
Suggested Action
```

Contoh:

```text
OVERCURRENT

Motor current exceeded configured limit.

Current
83.2 A

Limit
60 A

[ Clear Fault ]
```

Severity:

```text
Info
Warning
Error
Critical
```

---

# 28. Firmware Page

UI sederhana:

```text
Firmware

Device
SF Controller

Current Version
1.4.2

Firmware File
sf-controller-v1.5.0.bin

[ Select Firmware ]

────────────────────

Target Version
1.5.0

✓ Compatible

[ Update Firmware ]
```

---

# 29. Firmware Update Pipeline

```text
Select Firmware
     ↓
Validate File
     ↓
Check Hardware Compatibility
     ↓
Enter Bootloader
     ↓
Erase
     ↓
Upload
     ↓
Verify CRC
     ↓
Restart
     ↓
Reconnect
```

Jangan izinkan firmware flashing tanpa compatibility validation jika metadata tersedia.

---

# 30. Terminal

Simple terminal:

```text
Terminal

> status
Voltage: 48.1
Current: 1.3
Temperature: 42

> _
```

Features:

```text
Command history
Clear
Copy
Timestamp
Auto-scroll
Save log
```

---

# 31. Packet Inspector

Untuk developer mode:

```text
Tools
└── Packet Inspector
```

Contoh:

```text
12:42:03.241 RX

AA 07 12 00 31 42 3C 19 FF

Command
0x12 GET_TELEMETRY

Payload
31 42 3C 19

CRC
Valid
```

Ini sangat berguna saat debugging firmware.

---

# 32. Developer Mode

Default UI tidak menampilkan engineering internals.

Aktifkan:

```text
Settings
→ Developer Mode
```

Developer Mode membuka:

```text
Packet Inspector
Raw Terminal
Protocol Statistics
Device Logs
Debug Commands
Experimental Features
```

---

# 33. Command Palette

Implementasikan seperti Codex/VS Code.

Shortcut:

```text
Ctrl + K
```

atau:

```text
Ctrl + Shift + P
```

Commands:

```text
Connect Device
Disconnect Device
Open Telemetry
Read Configuration
Write Configuration
Export Configuration
Open Terminal
Restart Device
Open Firmware Update
Toggle Developer Mode
```

---

# 34. Keyboard Navigation

Target:

```text
Ctrl + K
Command Palette

Ctrl + ,
Settings

Ctrl + L
Connection Manager

Ctrl + R
Read Device

Ctrl + S
Write Configuration

Ctrl + Shift + T
Telemetry
```

Shortcut final dapat disesuaikan.

---

# 35. Toast / Notification

Contoh:

```text
✓ Configuration written

Motor configuration successfully updated.
```

Error:

```text
Unable to write configuration

Device timed out while waiting for response.

[ Retry ]
```

Jangan gunakan modal untuk setiap event.

---

# 36. Loading State

Hindari spinner besar.

Gunakan state lokal.

Contoh:

```text
Firmware Version
Reading...
```

atau skeleton subtle.

---

# 37. Error UX

Error message harus actionable.

Jangan:

```text
Connection Error
```

Gunakan:

```text
Unable to connect to COM8.

The port is currently unavailable or used by
another application.

[ Retry ]   [ Choose another port ]
```

---

# 38. Logging

Rust core harus memiliki structured logging.

Level:

```text
TRACE
DEBUG
INFO
WARN
ERROR
```

Log:

```text
Timestamp
Module
Device ID
Transport
Message
```

User dapat export logs.

---

# 39. Application Settings

Settings:

```text
Appearance

Theme
Dark

UI Scale
100%

─────────────────

Connection

Auto reconnect
ON

Remember last device
ON

─────────────────

Telemetry

Frontend refresh
60 Hz

History buffer
30 seconds

─────────────────

Developer

Developer mode
OFF
```

---

# 40. Suggested Project Structure

```text
sf-tools/
│
├── src/
│   │
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   ├── sidebar/
│   │   ├── titlebar/
│   │   ├── connection/
│   │   ├── configuration/
│   │   ├── telemetry/
│   │   └── device/
│   │
│   ├── features/
│   │   ├── connection/
│   │   ├── device/
│   │   ├── configuration/
│   │   ├── telemetry/
│   │   ├── diagnostics/
│   │   ├── firmware/
│   │   └── terminal/
│   │
│   ├── stores/
│   │   ├── connection-store.ts
│   │   ├── device-store.ts
│   │   ├── config-store.ts
│   │   └── telemetry-store.ts
│   │
│   ├── lib/
│   │   ├── tauri.ts
│   │   ├── units.ts
│   │   └── validation.ts
│   │
│   └── styles/
│       └── globals.css
│
├── src-tauri/
│   │
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   ├── device/
│   │   ├── protocol/
│   │   ├── transport/
│   │   │   ├── serial.rs
│   │   │   ├── tcp.rs
│   │   │   ├── udp.rs
│   │   │   └── usb.rs
│   │   │
│   │   ├── telemetry/
│   │   ├── firmware/
│   │   └── logging/
│   │
│   └── tauri.conf.json
│
├── public/
├── docs/
│   ├── protocol.md
│   ├── configuration-schema.md
│   └── firmware-format.md
│
├── package.json
└── README.md
```

---

# 41. Rust Modules

Recommended:

```text
src-tauri/src/

device/
├── manager.rs
├── info.rs
├── capabilities.rs
└── commands.rs

transport/
├── mod.rs
├── serial.rs
├── tcp.rs
├── udp.rs
└── usb.rs

protocol/
├── packet.rs
├── parser.rs
├── encoder.rs
├── crc.rs
└── command.rs

telemetry/
├── manager.rs
├── buffer.rs
└── signals.rs

firmware/
├── parser.rs
├── flasher.rs
└── validation.rs
```

---

# 42. Protocol Recommendation

Gunakan binary protocol untuk device communication.

Contoh:

```text
┌────────┬─────────┬─────────┬─────────┬─────┐
│ Header │ Command │ Length  │ Payload │ CRC │
└────────┴─────────┴─────────┴─────────┴─────┘
```

Contoh:

```text
AA
10
04 00
01 02 03 04
CRC16
```

Jangan menggunakan JSON sebagai protocol telemetry utama jika data rate tinggi.

JSON tetap dapat digunakan untuk:

```text
Configuration profile
Metadata
Debugging
Development tools
```

---

# 43. Command Model

Contoh commands:

```text
0x01 GET_DEVICE_INFO
0x02 GET_CAPABILITIES

0x10 READ_CONFIG
0x11 WRITE_CONFIG

0x20 START_TELEMETRY
0x21 STOP_TELEMETRY

0x30 GET_FAULTS
0x31 CLEAR_FAULTS

0x40 REBOOT
0x41 ENTER_BOOTLOADER
```

Detail protocol dibuat di dokumen terpisah.

---

# 44. Request/Response System

Setiap request:

```text
Request ID
Command
Payload
```

Response:

```text
Request ID
Status
Payload
```

Ini memungkinkan multiple asynchronous requests.

---

# 45. Timeout System

Setiap request memiliki:

```text
Timeout
Retry
Cancellation
```

Misalnya:

```text
Read config
Timeout: 500 ms
Retry: 2

Firmware block
Timeout: 1000 ms
Retry: 5
```

---

# 46. Connection State Machine

Gunakan explicit state:

```text
DISCONNECTED
     ↓
DISCOVERING
     ↓
CONNECTING
     ↓
HANDSHAKE
     ↓
CONNECTED
     ↓
RECONNECTING
```

Error:

```text
CONNECTION_ERROR
PROTOCOL_ERROR
INCOMPATIBLE_DEVICE
```

Jangan hanya menggunakan boolean:

```text
isConnected
```

---

# 47. Device Session

Satu connection menghasilkan:

```text
DeviceSession
```

Isi:

```text
Transport
Device ID
Firmware Version
Hardware Version
Capabilities
Configuration Schema
Telemetry Signals
Session State
```

---

# 48. MVP Scope

Versi pertama jangan langsung mengejar seluruh fitur VESC Tool.

## MVP v0.1

Fokus:

```text
✓ Desktop app
✓ Clean UI
✓ Serial connection
✓ Device discovery
✓ Device information
✓ Read config
✓ Edit config
✓ Write config
✓ Basic telemetry
✓ Basic logs
```

Tidak perlu dulu:

```text
CAN
TCP
UDP
Firmware flashing
Advanced graph
Scripting
Plugin system
Multiple devices
```

---

# 49. MVP Screens

Implementasikan hanya:

```text
1. Connection
2. Overview
3. Configuration
4. Telemetry
5. Settings
```

---

# 50. Phase 0 — Foundation

Goal:

> Membuat shell aplikasi desktop SF-Tools.

Tasks:

```text
[ ] Initialize Tauri 2
[ ] React
[ ] TypeScript
[ ] Vite
[ ] Tailwind CSS
[ ] shadcn/ui
[ ] Lucide icons
[ ] Zustand
[ ] Basic router
```

Kemudian:

```text
[ ] Custom titlebar
[ ] Sidebar
[ ] Main content
[ ] Dark design tokens
[ ] Typography
[ ] Button
[ ] Input
[ ] Select
[ ] Dialog
[ ] Tooltip
[ ] Toast
```

---

# 51. Phase 1 — Application Shell

Goal:

> Tampilan sudah terasa seperti produk SF-Tools.

Implement:

```text
[ ] Sidebar
[ ] Overview page
[ ] Configuration page shell
[ ] Telemetry page shell
[ ] Settings page
[ ] Connection indicator
[ ] Command palette
```

Pada fase ini belum perlu hardware.

Gunakan mock data.

---

# 52. Phase 2 — Rust Transport Layer

Implement:

```text
Transport trait
Serial transport
Port enumeration
Connect
Disconnect
Read
Write
Timeout
```

Tauri commands:

```text
list_serial_ports
connect_serial
disconnect
get_connection_state
```

---

# 53. Phase 3 — Protocol

Implement:

```text
Packet structure
Encoder
Decoder
Streaming parser
CRC
Command IDs
Request IDs
Timeout
Retry
```

Tambahkan unit test untuk:

```text
Packet encode
Packet decode
CRC
Fragmented packet
Multiple packets
Invalid packet
```

---

# 54. Phase 4 — Device Handshake

Saat connect:

```text
Serial Open
    ↓
PING
    ↓
GET_DEVICE_INFO
    ↓
GET_CAPABILITIES
    ↓
GET_CONFIG_SCHEMA
    ↓
CONNECTED
```

Frontend kemudian menerima:

```text
Device name
Hardware version
Firmware version
Capabilities
```

---

# 55. Phase 5 — Configuration Engine

Implement:

```text
Config schema
Config value
Read configuration
Edit local values
Dirty-state detection
Validation
Write configuration
Verify
Reset
```

UI dibuat schema-driven.

---

# 56. Phase 6 — Telemetry

Implement:

```text
Telemetry subscription
Rust telemetry buffer
Frontend event bridge
Telemetry store
Numeric widgets
Line chart
Signal selector
Pause
Clear
```

Performance test:

```text
10 Hz
50 Hz
100 Hz
500 Hz device data
```

Frontend tetap dibatasi ke refresh rate yang masuk akal.

---

# 57. Phase 7 — Profiles

Implement:

```text
Save profile
Open profile
Import
Export
Compatibility check
Profile metadata
```

File:

```text
.sfconfig
```

---

# 58. Phase 8 — Diagnostics

Implement:

```text
Connection statistics
Packet statistics
Faults
System information
Clear fault
Export log
```

---

# 59. Phase 9 — Firmware Update

Implement setelah communication protocol stabil.

```text
Firmware parser
Firmware metadata
Compatibility check
Bootloader
Chunk upload
Progress
CRC verify
Restart
Reconnect
```

---

# 60. Phase 10 — Advanced Connectivity

Tambahkan:

```text
TCP
UDP
USB
CAN adapter
```

Tetap menggunakan Device API yang sama.

Contoh:

```text
Device
    ↑
Protocol
    ↑
Transport
```

---

# 61. Phase 11 — Multi Device

Future:

```text
Devices

● SF Motor Controller
  COM8

● SF IO Controller
  COM9

● SF Power Module
  CAN 12
```

Satu aplikasi dapat mengontrol beberapa device.

---

# 62. Phase 12 — Plugin Architecture

Future only.

Plugin dapat menyediakan:

```text
Device definition
Configuration schema
Telemetry signals
Custom pages
Firmware handler
Protocol extensions
```

Jangan implementasikan plugin system pada MVP.

---

# 63. UI Component Requirements

Reusable components:

```text
<AppShell />

<Sidebar />

<DeviceStatus />

<ConnectionDialog />

<ParameterInput />

<ParameterSection />

<NumericTelemetry />

<TelemetryChart />

<DeviceInfo />

<FaultCard />

<FirmwareUpdater />

<Terminal />

<CommandPalette />
```

---

# 64. ParameterInput Component

Satu component menangani:

```text
Float
Integer
Boolean
Enum
String
Slider
```

Contoh penggunaan:

```tsx
<ParameterInput
  parameter={schema}
  value={value}
  onChange={updateParameter}
/>
```

Ini menghindari ratusan custom form.

---

# 65. Telemetry Component Strategy

Pisahkan:

```text
Telemetry source
Telemetry storage
Telemetry rendering
```

Jangan:

```text
Serial packet
→ langsung setState()
→ graph
```

---

# 66. Performance Targets

Startup:

```text
< 2 seconds
```

Idle CPU:

```text
< 2%
```

Normal memory:

```text
Target < 150 MB
```

Telemetry UI:

```text
60 FPS target
```

Connection:

```text
No UI blocking
```

---

# 67. Robustness Requirements

SF-Tools harus aman menghadapi:

```text
USB unplug
Serial timeout
Partial packet
Malformed packet
CRC error
Device reboot
Firmware mismatch
Slow device
Port suddenly unavailable
```

Application tidak boleh crash.

---

# 68. Testing

## Rust Unit Tests

```text
Protocol
CRC
Parser
Config encoding
Firmware validation
```

---

## Frontend Unit Tests

```text
Parameter validation
Dirty state
Capability filtering
Config conversion
```

---

## Integration Tests

```text
Connect
Handshake
Read config
Write config
Telemetry
Reconnect
```

---

# 69. Device Simulator

Sangat disarankan membuat:

```text
SF Device Simulator
```

Simulator dapat berjalan di PC.

Simulasikan:

```text
Serial/TCP device
Telemetry
Configuration
Fault
Disconnect
CRC error
Delay
Firmware versions
```

Keuntungan:

Frontend dan protocol dapat dikembangkan tanpa hardware.

---

# 70. Mock Device Modes

Simulator:

```text
Normal
Slow Connection
Packet Loss
CRC Error
Firmware Old
Overtemperature
Overcurrent
Random Disconnect
```

---

# 71. Security / Safety

Untuk command berbahaya:

```text
Factory Reset
Firmware Flash
Bootloader
Calibration
```

Gunakan confirmation dialog.

Contoh:

```text
Factory reset device?

This will restore all configuration values
to defaults.

[ Cancel ] [ Factory Reset ]
```

Tidak perlu confirmation untuk:

```text
Page navigation
Telemetry
Read operation
Normal parameter editing
```

---

# 72. Branding

Nama:

```text
SF-Tools
```

Brand direction:

```text
Technical
Minimal
Professional
Engineering
Modern
```

Hindari tampilan:

```text
Gaming
RGB
Cyberpunk
Overly futuristic
Industrial legacy UI
```

---

# 73. Suggested Home Screen

Disconnected:

```text
                  SF-Tools

             No device connected

       Connect a device to configure,
       monitor, and diagnose hardware.

              [ Connect Device ]

             Recent Devices
        SF Controller — COM8
```

Connected:

```text
                  SF Controller

                   Connected

             Firmware 1.4.2
             Hardware V2

       [ Configure ]  [ Telemetry ]

          No active warnings
```

---

# 74. Suggested Navigation

Final recommendation:

```text
Overview

Device
├── Configuration
├── Telemetry
└── Diagnostics

Firmware

Terminal

Settings
```

Jika nanti banyak subsystem:

```text
Configuration
├── Motor
├── Control
├── Sensors
├── Input
└── Communication
```

---

# 75. Suggested Development Order

Urutan terbaik:

```text
01 UI Shell
02 Mock Device
03 Serial Transport
04 Protocol
05 Handshake
06 Configuration
07 Telemetry
08 Profiles
09 Diagnostics
10 Firmware
11 TCP / UDP / CAN
12 Multi-device
13 Plugins
```

Jangan memulai dari graph atau firmware updater.

Communication architecture harus stabil terlebih dahulu.

---

# 76. First Milestone

SF-Tools v0.1 dianggap berhasil jika user dapat:

```text
Open SF-Tools.exe

        ↓

Connect COM port

        ↓

SF-Tools mengenali device

        ↓

Device info muncul

        ↓

Read configuration

        ↓

Edit parameter

        ↓

Write configuration

        ↓

Melihat telemetry
```

Dengan UI minimal dan tanpa membuka terminal/manual tools.

---

# 77. MVP Acceptance Criteria

## Connection

```text
[ ] Serial ports terdeteksi
[ ] Device dapat connect
[ ] Device dapat disconnect
[ ] USB unplug tidak membuat app crash
[ ] Auto reconnect optional
```

## Device

```text
[ ] Device name tampil
[ ] Firmware version tampil
[ ] Hardware version tampil
[ ] Capability tampil
```

## Configuration

```text
[ ] Config dapat dibaca
[ ] Config dapat diedit
[ ] Invalid value ditolak
[ ] Modified value terlihat
[ ] Config dapat ditulis
[ ] Write diverifikasi
```

## Telemetry

```text
[ ] Telemetry realtime
[ ] Numeric telemetry
[ ] Minimal line graph
[ ] Pause/resume
[ ] UI tidak freeze
```

## Application

```text
[ ] Installer Windows
[ ] `.exe`
[ ] Dark UI
[ ] Custom icon
[ ] Graceful error handling
```

---

# 78. Suggested Release Roadmap

## SF-Tools 0.1

```text
Serial
Device Info
Configuration
Telemetry
```

## SF-Tools 0.2

```text
Profiles
Diagnostics
Terminal
Logging
```

## SF-Tools 0.3

```text
Firmware Update
Device Simulator
Advanced Telemetry
```

## SF-Tools 0.4

```text
TCP
UDP
CAN
```

## SF-Tools 0.5

```text
Multi-device
Device plugins
```

## SF-Tools 1.0

```text
Stable Protocol
Stable Configuration Schema
Firmware Management
Diagnostics
Profiles
Telemetry
Multiple Transports
Production Installer
```

---

# 79. Definition of Done for v1.0

SF-Tools 1.0 harus:

```text
✓ Reliable
✓ Fast
✓ Minimal UI
✓ Transport-independent
✓ Firmware-version aware
✓ Schema-driven
✓ Recover from disconnect
✓ Safe configuration workflow
✓ Good diagnostic visibility
✓ Easy to distribute as .exe
```

---

# 80. Final Architecture Recommendation

Gunakan:

```text
Tauri 2
│
├── React + TypeScript
│   ├── Tailwind CSS
│   ├── shadcn/ui
│   ├── Lucide
│   ├── Zustand
│   └── Telemetry visualization
│
└── Rust
    ├── Device Manager
    ├── Protocol
    ├── Serial
    ├── TCP
    ├── UDP
    ├── USB
    ├── CAN
    ├── Telemetry
    ├── Firmware
    └── Logging
```

Prinsip paling penting:

> **VESC Tool menjadi referensi kemampuan, Codex menjadi referensi UX.**

SF-Tools tidak perlu terlihat seperti sebuah engineering/debugging tool tradisional.

Tujuannya adalah:

> **engineering tool yang powerful di belakang, tetapi sederhana di depan.**
