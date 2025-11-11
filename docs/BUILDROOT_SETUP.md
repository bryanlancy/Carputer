# Buildroot Setup for Carputer

This document captures the steps, options, and rationale for building a fast-booting Raspberry Pi image with Buildroot for the Carputer project. It is written to be a repeatable checklist: start here whenever you update Buildroot, onboard a new teammate, or rebuild the image from scratch.

---

## 1. Project Goals
- Boot the Raspberry Pi into the Carputer hub app as quickly as possible.
- Support HDMI display with an animated boot video, touchscreen input (if present), and USB HID devices.
- Expose CAN bus, I²C, SPI, UART, and GPIO for attached sensors and co-processor boards (e.g., Arduino CAN decoder).
- Provide network connectivity (Ethernet, Wi-Fi, Bluetooth) for updates and telemetry.
- Host a modular app platform where the hub process can load and communicate with “applets” (LED controller, settings, media, etc.).

Keep these in mind when choosing Buildroot options—anything not required for these outcomes is a candidate for removal to reduce boot time.

---

## 2. Host Prerequisites (macOS 14+)
Buildroot recommends running on Linux, but it works on macOS with the correct GNU tools:

```sh
brew install coreutils findutils gawk gnu-sed gnu-tar grep wget xz gnu-getopt pkg-config cmake ninja git-lfs
brew install python@3.12
```

Add the GNU tools to your `PATH` (append to `~/.zshrc`):

```sh
export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:/opt/homebrew/opt/findutils/libexec/gnubin:/opt/homebrew/opt/gnu-sed/libexec/gnubin:/opt/homebrew/opt/grep/libexec/gnubin:$PATH"
export PATH="/opt/homebrew/opt/python@3.12/bin:$PATH"
```

Install Docker Desktop if you prefer building inside a Linux container; Buildroot runs fine in a light Debian container.

---

## 3. Repository Layout
Recommended structure inside `Carputer/`:

```
Carputer/
├─ buildroot/                # Buildroot source (git submodule)
├─ board/carputer/           # Custom board support files
│  ├─ overlays/              # Device tree overlays and config.txt fragments
│  ├─ post-build.sh          # Rootfs tweaks
│  └─ rootfs-overlay/        # Files copied into target root
├─ package/carputer-app/     # Buildroot package for the hub application
├─ apps/                     # Source for bundled applets
├─ docs/                     # Design docs (this file)
└─ README.md
```

Initialize Buildroot as a submodule so upgrades are explicit:

```sh
git submodule add https://git.buildroot.net/buildroot buildroot
cd buildroot
git checkout 2024.08
cd ..
```

The rest of the instructions assume this layout.

---

## 4. Choose a Baseline Defconfig
Pick the Raspberry Pi target closest to your hardware:

- Pi 4 / Compute Module 4: `raspberrypi4_64_defconfig`
- Pi 3B+/Compute Module 3+: `raspberrypi3_64_defconfig`
- Pi 5 (once supported): check `configs/` for the latest defconfig

Copy the defconfig to keep a project-specific baseline:

```sh
cd buildroot
cp configs/raspberrypi4_64_defconfig configs/carputer_defconfig
```

Edit the copy (or layer settings through `make menuconfig`). Our `carputer_defconfig` is the source of truth—commit it to version control.

---

## 5. Configure Buildroot

### Step 5.1: Run the configuration menu

```sh
cd /Users/bryanburns/Documents/Programming/Carputer/buildroot
make carputer_defconfig
make menuconfig
```

Key settings to adjust in `menuconfig`:

- `Target packages → Graphic libraries and applications → Enable EGL/GLES/Vulkan stack` (`BR2_PACKAGE_RPI_USERLAND`) for accelerated video playback.
- `Target packages → Audio and video applications → mpv` for boot video playback. Enable dependencies (FFmpeg with Raspberry Pi hardware acceleration).
- `Target packages → Hardware handling → can-utils`, `python-can`, `i2c-tools`, `spi-tools`.
- `Target packages → Networking applications` → add `connman` or `network-manager` for flexible connectivity, or keep `busybox` `udhcpcd` for minimal setups.
- `System configuration → Init system` → stay with BusyBox init for lowest boot time. Configure `BR2_INIT_NONE` with a custom `/etc/inittab` or use a single `carputer-start` script.
- `Filesystem and Flash` → enable `ext4` root filesystem image. Optionally add `squashfs` + `overlayfs` for read-only root with persistence in `/data`.
- `System configuration → Root filesystem overlay directories` → set to `../board/carputer/rootfs-overlay`.
- `System configuration → Custom scripts to run` → set `../board/carputer/post-build.sh` and `../board/carputer/post-image.sh` when you create them.
- `Toolchain` → keep the bundled `Buildroot toolchain` for simplicity, or switch to an external Linaro toolchain if you need GCC/LTO features not available internally.

Save the configuration when done (`.config`). Regenerate `configs/carputer_defconfig` to record changes:

```sh
make savedefconfig
cp defconfig ../buildroot-configs/carputer_defconfig    # optional tracked copy
```

---

## 6. Linux Kernel Configuration

Run:

```sh
make linux-menuconfig
```

Enable built-in kernel options needed at boot:

- Device Drivers → Network device support → CAN bus subsystem → build-in `SocketCAN` core and drivers (e.g., `mcp251x`, `can-dev`, `can-raw`).
- Device Drivers → SPI/I²C/I3C support → build in the controllers you rely on.
- Device Drivers → GPIO → build in Pi-specific and expander drivers.
- Device Drivers → Input device support → enable touchscreens (`FT5406`, `ADS7846`, etc.).
- File systems → `OverlayFS`, `F2FS` (if using eMMC/SD focus).
- Graphics → DRM → enable Raspberry Pi DRM driver, VC4.
- Sound → ALSA, HDMI audio.

Bake as many modules as possible directly into the kernel (`[*]`) to avoid module load delays. For overlays, place `*.dtbo` in `board/carputer/overlays/` and reference them in `config.txt`.

Export kernel config after changes:

```sh
make linux-update-defconfig
```

Store the resulting `linux/defconfig` under version control (e.g., `board/carputer/linux_defconfig`).

---

## 7. Boot Flow Customization

### 7.1 Reduce Boot Targets
- Disable getty/console login (`BR2_TARGET_GENERIC_GETTY=n`).
- Disable unnecessary services (cron, syslog, package managers).
- Use BusyBox init with a single `::sysinit:/etc/init.d/rcS` script that launches the hub app directly.
- Consider `BR2_TARGET_ROOTFS_TAR=n` and only keep the image formats you flash.

### 7.2 Boot Splash / Video
Options ranked by complexity:
- **Static splash**: use `fbi` or `ply-image` to show a PNG from `/etc/init.d/S02splash`.
- **Animated video**: install `mpv` or `omxplayer`, place boot video in `/usr/share/carputer/boot.mp4`, and spawn the player in an early init script. Kill it once the hub UI is ready.
- **Custom DRM app**: draw directly through `/dev/dri/card0` for zero dependencies (requires OpenGL/GLES code).

Ensure GPU memory split is set in `board/carputer/config.txt` (e.g., `gpu_mem=128`).

### 7.3 auto-start the Hub
- Provide `/etc/init.d/S05carputer` that:
  1. Launches boot video
  2. Starts `carputer-hub` binary (your app)
  3. Waits for hub readiness, then terminates the video player
- Keep the script idempotent so it can be restarted manually for debugging.

---

## 8. Carputer Hub Buildroot Package

Create `package/carputer-app/` with:
- `Config.in` describing configurable options (e.g., enable bundled applets, select UI toolkit).
- `carputer-app.mk` building the application from your repo (e.g., Meson, CMake, or npm build + Electron packaging).
- `hash/carputer-app.hash` with source checksums.

The package should install:
- Hub executable (`/usr/bin/carputer-hub`)
- Applet manifests (`/usr/share/carputer/applets/`)
- Assets (`/usr/share/carputer/ui/`)
- Systemd unit or init script templates if you later adopt systemd.

Add the package to Buildroot:
- Append `source "package/carputer-app/Config.in"` inside the appropriate section of `package/Config.in`.
- Enable it in `menuconfig` (`Target packages → Custom → Carputer Hub`).

Consider splitting applets into separate packages if they have heavy dependencies—this keeps the hub lean and lets you enable/disable applets per build.

---

## 9. Inter-Process Communication for Applets

Plan a stable interface for applets before finalizing runtime packages. Options:
- **gRPC over Unix sockets** (requires `protobuf`, `grpc` packages).
- **DBus** (enable `dbus`, `dbus-c++`).
- **ZeroMQ or nanomsg** for lightweight messaging.
- **Shared memory / POSIX message queues** if latency is critical.

Enable the corresponding Buildroot packages and make sure they start with the hub during boot.

---

## 10. Networking & Updates

- Choose a network manager (BusyBox scripts vs. ConnMan vs. NetworkManager) and enable the matching Buildroot package.
- For OTA updates, evaluate:
  - `swupdate`
  - `rauc`
  - Custom A/B partition strategy managed by the hub
- Add `openssh` for remote maintenance; disable password auth if you only use SSH keys.

---

## 11. Building the Image

```sh
cd /Users/bryanburns/Documents/Programming/Carputer/buildroot
make carputer_defconfig
make
```

Artifacts appear under `output/images/`:
- `sdcard.img` (if `rpi-firmware` packaging is enabled)
- `rootfs.ext4` or `rootfs.squashfs`
- `zImage` / `Image` and `bcm2711-rpi-4-b.dtb`

Flash the image to an SD card:

```sh
diskutil list                               # identify the target disk (e.g., /dev/disk4)
diskutil unmountDisk /dev/disk4
sudo dd if=output/images/sdcard.img of=/dev/rdisk4 bs=4m status=progress conv=sync
diskutil eject /dev/disk4
```

Alternatively use Raspberry Pi Imager, pointing it at the generated `.img`.

---

## 12. Testing & Iteration

- Keep a spare HDMI monitor attached for first boots; check `/var/log/messages` via serial console if boot fails.
- Use `systemd-analyze` equivalent timings (or custom scripts) to profile boot time; disable services until you hit target (<5–10 seconds).
- Automate regression tests using QEMU when possible: Buildroot can run Raspberry Pi builds in QEMU for smoke checks.
- Commit configuration changes (`carputer_defconfig`, `board/carputer` custom files, package makefiles). Treat `buildroot` submodule updates as dedicated commits.

---

## 13. Maintenance Checklist

- **After Buildroot upgrades**: rerun `make oldconfig`, revalidate kernel config, rebuild images.
- **Before releases**: freeze package versions (pin git hashes), rebuild from scratch (`rm -rf output/`) to ensure reproducibility.
- **Security**: enable `br2-package-busybox show all` to confirm BusyBox version, update TLS libraries (`openssl`, `mbedtls`), run vulnerability scan on deployed rootfs if possible.
- **Backups**: store `output/images/` artifacts per release in cloud storage together with the squashfs signature.

---

## 14. Next Steps
- Implement `board/carputer/post-build.sh` to install boot video, configure splash service, and copy default configs.
- Prototype the hub app as a Qt/QML or Electron application; determine runtime requirements and add them to the Buildroot package.
- Design CAN data schema exposed by the Arduino bridge; define gRPC/DBus interfaces for applets.
- Add automated GitHub Actions job that runs `make carputer_defconfig && make nconfig savedefconfig` to detect configuration drift.

Keep this file updated as the system evolves. Document every new dependency or kernel tweak so rebuilding the image months later is painless.

