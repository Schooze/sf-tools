# SF-Tools 0.2.0

Aplikasi desktop Windows untuk SF-Motion **0.3.0**, berdasarkan [firmware commit 2e58c941](https://github.com/sirojudinMunir/sf-motion/commit/2e58c941620b2fbd82c751d390fcecee27f16ece) (21 November 2026). Protokol firmware lama tidak didukung.

## Menjalankan

- Installer: [release/SF-Tools-Setup.exe](release/SF-Tools-Setup.exe).
- Portable: jalankan [release/sf-tools.exe](release/sf-tools.exe) dengan **WebView2Loader.dll tetap berada di direktori yang sama**.
- Windows memerlukan Microsoft Edge WebView2 Runtime. Installer menggunakan pemeriksaan/bootstrapper WebView2 standar Tauri.
- Pilih port USB serial, baudrate (default 115200), dan node (default 0). Simulator harus dipilih secara eksplisit melalui port SIMULATOR.
- Koneksi COM benar-benar membuka port; kegagalan perangkat tidak diganti dengan data simulator.
- Preview web hanya untuk tampilan. Akses perangkat dan simulator tersedia dalam aplikasi desktop.

## Kesesuaian fitur

| Fitur firmware | Dukungan SF-Tools |
|---|---|
| Versi firmware, ID node | Handshake versi dan pencocokan node respons |
| Register read/write | Katalog bersama, pemeriksaan tipe, ACK dan baca ulang |
| Parameter motor dan PID | Editor berkelompok, Apply, Revert, profil |
| FOC sensored / SMO+HFI / SMO+HFI New / Hybrid | Pemilihan mode sesuai enum |
| Motor Disable / Torque / Speed / Position / Impedance / Voltage | Motion Control dan terminal |
| Motor enable/disable | Tindakan eksplisit; E-STOP diprioritaskan |
| Impedance dan current feedforward | Parameter dan referensi posisi/kecepatan/arus |
| Field weakening, MTPA | Konfigurasi lengkap yang diekspos register |
| Sensor arus/tegangan dan encoder PLL | Konfigurasi sesuai register dan catatan penerapan |
| Trajectory S-curve | Target posisi, batas kecepatan, percepatan, jerk |
| PVT | Editor/CSV, append, run, stop, pelaporan upload parsial |
| Rs, Ld, Lq, encoder, pole pairs | Commissioning berbasis event selesai |
| Cogging / anti-cogging | Pengukuran, akuisisi LUT 1024 sampel, CSV, enable kompensasi |
| Proteksi I²t / under-voltage / over-voltage | Parameter dan riwayat event yang diterima |
| Streaming | Maksimal 10 kanal per node, plotter, perekaman CSV |
| Save / default / reset | Operasi firmware nyata; reset dilaporkan sebagai terkirim |
| Update firmware | Informasi versi dan panduan ST-Link/PlatformIO |
| Audio, flashing USB, clear-fault, suhu | Tidak ditampilkan sebagai fitur perangkat yang tersedia |

Satu node aktif pada satu waktu. Pemilihan node mendukung USB langsung atau bridge USB-to-CAN firmware. Adaptor CAN pihak ketiga dan gerakan banyak motor serentak tidak termasuk.

## Alur konfigurasi dan kontrol

1. Connect dan baca konfigurasi aktual. Nilai offline ditandai sebagai default firmware.
2. Edit parameter atau impor profil. **Apply to device** hanya menulis perubahan dan memeriksa baca ulang sesuai representasi float32/u8/u32. Parameter yang gagal tetap ditandai berubah.
3. **Save to flash** menyimpan konfigurasi secara terpisah. Parameter staged tetap perlu restart.
4. Buka Motion Control, pilih mode, lalu **Enable selected mode**. Pengaktifan menetralkan mode sebelumnya sebelum memilih mode baru; tidak dilakukan otomatis saat Connect.
5. Untuk commissioning, tekan **Enable output for commissioning** terlebih dahulu. Pengukuran ditolak bila enable belum diakui dalam sesi aktif. Kirim setpoint sesuai mode aktif. Posisi menggunakan derajat, kecepatan RPM, sudut elektrik radian.
6. **E-STOP** membatalkan generasi perintah lama, mendahulukan disable register 102, kemudian menghentikan PVT melalui 104. Pesan hasil mengikuti ACK perangkat.
7. Restore defaults menonaktifkan keluaran dan PVT terlebih dahulu, menggunakan perintah firmware, lalu berpindah ke node default 0. Save ke flash tetap terpisah.

Profil baru menggunakan format 2 dengan nama register firmware. Impor format 1 memetakan nama parameter dan mode lama secara eksplisit; parameter yang tidak tersedia (misalnya max_rpm) dilewati dan dilaporkan. Profil tidak langsung diterapkan ke perangkat.

## Batasan firmware yang perlu diketahui

- Header USB adalah A5 A5, diikuti panjang payload, tipe, node, register, dan data little-endian. **Tidak ada CRC/checksum**. Respons write berisi status int8: 0 berhasil, nilai negatif gagal.
- Katalog [shared/registers.json](shared/registers.json) digunakan Rust, frontend, simulator, dan referensi protokol. Sumber upstream disimpan dengan commit dan lisensi di shared/firmware. Register 1 (versi, tiga byte) dan 103 (PVT float32 + int16) dilengkapi dari handler C karena belum tercantum di JSON upstream.
- Nomor mode: 0 Disable, 1 Torque, 2 Speed, 3 Position, 4 Impedance, 5 Audio, 6 Voltage. Audio belum memiliki jalur kontrol aktif sehingga tidak dapat dipilih.
- Register PWM 21 hanya menyimpan setting. Frekuensi efektif build firmware ini tetap **40 kHz**, walaupun default register tersimpan 20 kHz.
- ID node dan setting encoder tertentu memerlukan save/restart. ID yang dibaca dari register 2 dapat merupakan ID staged; node pada header respons adalah identitas routing aktif.
- Setter arah fase 90 mengubah storage, tetapi Save menimpanya dari arah fase aktif. Editor menampilkan nilai ini read-only; gunakan commissioning pole pairs untuk menentukan arah aktif.
- Firmware tidak mengekspos hardware revision, serial unik, suhu, query fault aktif, atau clear-fault. Riwayat event bukan bukti bahwa semua fault saat ini sudah diketahui.
- move_done didefinisikan dalam katalog event, tetapi tidak dikirim secara andal oleh jalur trajectory/PVT ini. UI tidak mengklaim gerakan selesai hanya berdasarkan ACK atau timer host.
- PVT berkapasitas 256 titik, interval 1 ms, posisi float32 dalam derajat dan kecepatan int16 dalam derajat/detik. Upload **menambah** isi buffer; Stop tidak menghapusnya. Tidak ada query occupancy/status atau clear-buffer; restart mengosongkan buffer volatile. ACK Run tidak membuktikan ada titik yang dimainkan.
- Commissioning menunggu event setelah operasi dimulai. Event dapat hilang; timeout berarti penyelesaian belum terkonfirmasi. Tidak ada register abort commissioning: E-STOP menonaktifkan keluaran dan menghentikan penantian host, tetapi rutinitas internal firmware dapat tetap aktif.
- Kanal 92 merupakan keluaran LUT cogging berhingga, bukan kanal telemetry kontinu. Akuisisi khusus menyimpan 1024 sampel dan memulihkan langganan normal. Firmware mengirim LUT otomatis hanya pada USB langsung; melalui bridge USB-to-CAN, pengukuran dapat selesai tetapi akuisisi LUT akan dilaporkan tidak lengkap bila sampel tidak dikirim.
- Parser memisahkan respons, event, dan streaming. Timeout respons menutup sesi untuk menghindari pemakaian respons lama sebagai respons permintaan berikutnya; reconnect harus eksplisit.
- Statistik dan packet inspector berasal dari transport nyata. CSV menyertakan node dan membiarkan nilai kosong untuk data yang tidak tersedia/kedaluwarsa. Snapshot UI sekitar 60 Hz, bukan rekaman lossless seluruh frame firmware.
- Simulator memakai katalog, frame, batas kanal, mode, ACK, event commissioning, serta buffer PVT yang sama; model dinamika adalah pendekatan dan tidak membuktikan performa atau keselamatan perangkat fisik.

## Pengembangan dan pengujian

Prasyarat: Node/npm, Rust toolchain Windows, WebView2 Runtime, serta linker Windows yang sesuai.

~~~powershell
npm install
npm test
npm run test:rust
npm run build
npm run prepare:runtime
npm run tauri dev
~~~

Tes inti Rust dijalankan tanpa fitur desktop agar tidak bergantung pada DLL/activation context Common Controls dari executable GUI. Build aplikasi tetap memakai fitur desktop default. Tes frontend mencakup model konfigurasi/profil/PVT/telemetry dan render statis semua halaman dengan snapshot state; tes ini bukan otomatisasi mouse/keyboard.

~~~powershell
npm run build:windows
~~~

Script mengambil loader x64 dari versi webview2-com-sys di Cargo.lock, menjalankan Tauri/NSIS, dan menyalin EXE, loader, installer serta SHA256SUMS.txt ke release/. Tool installer dicache di src-tauri/target/.tauri/; unduhan awal NSIS/plugin dan komponen WebView2 memerlukan internet. Kompilasi Cargo menggunakan dependensi cache secara offline.

Pemeriksaan executable produksi tanpa perangkat fisik:

~~~powershell
$p = Start-Process -FilePath .\release\sf-tools.exe -ArgumentList @('--self-test','D:/Projects/sf-tools/sf-tools/release/validation.json') -WindowStyle Hidden -PassThru -Wait
$p.ExitCode
Get-Content .\release\validation.json
~~~

Self-test membuka simulator melalui worker/protokol yang sama, menguji handshake, disabled start, konfigurasi, streaming, commissioning, PVT, serta E-STOP. Kode keluar 0 dan laporan ok:true menandakan lulus. Self-test tidak membuka port COM atau menggerakkan motor fisik.

## Status verifikasi

- Laporan executable terbaru: release/validation.json.
- Pengujian perangkat fisik harus dilakukan terpisah dengan board yang sesuai.
- Pemeriksaan UI interaktif dalam sesi pembaruan ini dihentikan pengguna melalui Escape; hasil tersebut tidak dinyatakan sebagai smoke test UI yang lulus.
