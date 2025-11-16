# Buildroot Setup for Carputer

This document captures the steps, options, and rationale for building a fast-booting Raspberry Pi image with Buildroot for the Carputer project. It is written to be a repeatable checklist: start here whenever you update Buildroot, onboard a new teammate, or rebuild the image from scratch.

---

## 1. Project Goals
- Boot the Raspberry Pi into the Carputer hub app as quickly as possible.
- Support HDMI display with an animated boot video, touchscreen input (if present), and USB HID devices.
- Provide flexible connectivity (Ethernet, Wi-Fi, Bluetooth, USB, GPIO, CAN adapters, serial bridges) so external modules can integrate quickly.
- Host a modular app platform where the hub process can load and communicate with “applets” (LED controller, settings, media, CAN bridge, etc.).
- Keep the hub’s own responsibilities focused on orchestration and communications plumbing; delegate protocol-specific logic (e.g., CAN decoding) to applets or companion devices.

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
- `Target packages → Hardware handling → i2c-tools`, `spi-tools`, `python3` with relevant serial/GPIO libs. Add `can-utils` or `python-can` only if an applet requires it.
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
  4. Exposes common IPC endpoints (Unix sockets, DBus names, REST port, etc.) so specialized applets can register themselves and handle protocols like CAN.
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

### 11.1 Recommended: helper script

Use the repository script to keep Buildroot invocations consistent and incremental:

```sh
/home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh defconfig
/home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh build
```

Common commands:
- `buildroot-build.sh build` — runs the full build, auto-applying the defconfig if `.config` is missing.
- `buildroot-build.sh menuconfig` — opens `make menuconfig` using the existing output directory.
- `buildroot-build.sh linux-menuconfig` — opens the kernel `menuconfig`.
- `buildroot-build.sh deploy` — rsyncs `buildroot/output/target/` into your NFS export (set `CARPUTER_NFS_TARGET=/srv/nfs/carputer-rootfs` or pass `--deploy-target`).
- `buildroot-build.sh clean-output` — removes `buildroot/output/` (only when you explicitly confirm; keep incremental builds whenever possible).
- All `make` invocations stream into timestamped log files under `/home/bryanb/Documents/Programming/Carputer/logs/buildroot`. Successful runs delete their log automatically unless you pass `--debug`, which keeps the file for post-mortem review.
- After a successful `build`, the script verifies that `output/images/sdcard.img` was freshly regenerated; it warns and fails if the image is missing or its timestamp did not change.

Override defaults when needed:

```sh
/home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh --defconfig raspberrypi4_64_defconfig build
/home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh --output /tmp/br-out --jobs 8 build
```

The script always runs builds from `/home/bryanb/Documents/Programming/Carputer/buildroot`, passes `O=<output>` to keep incremental artifacts, and refuses to remove downloads.

### 11.2 Manual commands

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

## 12. NFS Root & Incremental Deployment

### 12.1 Why use NFS root
- Flash the SD card once, then leave `/boot` alone—rootfs lives on your development machine.
- Every Buildroot rebuild is immediately available; the Pi simply reboots and mounts the updated tree.
- Works great with Qt modules: tweak QML/C++ locally, rebuild, reboot, and see the result.

### 12.2 Host export
1. Install the NFS server once (Ubuntu example):
   ```sh
   sudo apt install nfs-kernel-server
   sudo mkdir -p /srv/nfs/carputer-rootfs
   ```
2. Export the directory (append to `/etc/exports`):
   ```
   /srv/nfs/carputer-rootfs 192.168.1.0/24(rw,sync,no_subtree_check,no_root_squash)
   ```
3. Reload exports and open the firewall if needed:
   ```sh
   sudo exportfs -ra
   sudo ufw allow nfs
   ```
4. Keep the export in sync with the latest Buildroot rootfs:
   ```sh
   CARPUTER_NFS_TARGET=/srv/nfs/carputer-rootfs \
     /home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh deploy
   ```
   The `deploy` command runs `rsync -a --delete --numeric-ids` from `buildroot/output/target/` into the export (pass `--deploy-rsync-opts "--info=name0,progress2"` if you want more output).
   Add `--force-update` when the new rootfs requires an on-device restart of services; this drops a `var/lib/carputer/force-update` marker so the Pi runs its update hook automatically during the next boot.

### 12.3 Buildroot & kernel settings
- Kernel (`make linux-menuconfig`):
  - `General setup → Initial RAM filesystem and RAM disk → Initramfs source file`: leave empty.
  - `File systems → Network File Systems → NFS client support`.
  - Build in the NIC driver you use at boot (e.g., `CONFIG_BROADCOM_GENET=y` for Pi 4).
  - `Networking support → IP: kernel level autoconfiguration → DHCP`.
- Buildroot (`make menuconfig`):
  - Keep `BR2_ROOTFS_OVERLAY` pointing to `board/carputer/rootfs-overlay` (works with NFS too).
  - Set `BR2_TARGET_ROOTFS_TAR=y` if you also want a tarball (`output/images/rootfs.tar`).
  - Optional: disable `BR2_TARGET_ROOTFS_EXT2` once you rely solely on NFS.

### 12.4 Raspberry Pi boot configuration
- Leave the Pi boot partition on the SD card; replace `/boot/cmdline.txt` with something like:
  ```
  console=serial0,115200 console=tty1 root=/dev/nfs rw ip=dhcp \
  nfsroot=192.168.1.10:/srv/nfs/carputer-rootfs,v3,tcp rootwait elevator=noop
  ```
  Replace `192.168.1.10` with your build host’s IP. `rootwait` is harmless; keep it if USB boot is involved.
- Ensure `/boot/config.txt` matches your Buildroot-generated firmware (copy from `output/images/rpi-firmware/` when needed).
- Keep a static SSH key in the overlay (`board/carputer/rootfs-overlay/root/.ssh/authorized_keys`) so you can manage the Pi even if DHCP assigns a new lease.

### 12.5 Workflow summary
- Build: `/home/bryanb/Documents/Programming/Carputer/scripts/buildroot-build.sh build`
- Sync rootfs export: either rerun `buildroot-build.sh deploy` (optionally with `--force-update`) or set `CARPUTER_NFS_TARGET` and run `deploy` automatically in CI.
- Reboot the Pi (`ssh carputer sudo reboot`)—no reflashing or SD card swaps. If you used `--force-update`, `/usr/sbin/carputer-update` will run during boot and clear the marker once hooks finish.
- For Qt-only tweaks, rebuild just the relevant package, deploy, reboot, and test.
- Extend the on-device update flow by dropping executable hooks in `/usr/lib/carputer/update.d`. They run in lexical order whenever `carputer-update` triggers.

### 12.6 Wi-Fi credentials via `.env`
1. Copy `env.example` to `.env` (gitignored) and set:
   ```
   CARPUTER_WIFI_SSID="HeadquartersNet"
   CARPUTER_WIFI_PSK="super-secret-passphrase"
   CARPUTER_HOST_IP="192.168.1.10"
   CARPUTER_DEVICE_NAME="carputer-headunit"
   CARPUTER_SSH_PUBLIC_KEY="ssh-ed25519 AAAA..."
   CARPUTER_USE_NFS=0
   CARPUTER_ENABLE_UI=1
   ```
1. Each `buildroot-build.sh build` run reads `.env`, generates `board/carputer/generated/wifi/wpa_supplicant.conf`, `board/carputer/generated/boot/cmdline.txt`, `board/carputer/generated/etc/hostname`, and (optionally) `board/carputer/generated/ssh/authorized_keys`, then installs them into the image so the Pi knows which Wi-Fi to join, which rootfs source to use (SD vs. NFS), which hostname to publish (`carputer-headunit.local` via mDNS), and which SSH trust model to use.
1. Leave `CARPUTER_SSH_PUBLIC_KEY` empty to keep the default `carputer` / `carputer` credentials available. If you supply a key, password logins are disabled and the key is written into `/home/carputer/.ssh/authorized_keys` during the build.
1. Set `CARPUTER_USE_NFS=0` while bringing up Wi-Fi; this emits an SD-root `cmdline.txt` so the Pi boots from its local partition even if networking fails. Flip it to `1` once Wi-Fi is rock solid; make sure `CARPUTER_HOST_IP` points at your NFS server or the kernel will hang waiting for the mount.
1. Set `CARPUTER_ENABLE_UI=0` temporarily to skip launching the Qt UI and drop straight into a `carputer` shell on `tty1`—handy while debugging Wi-Fi or display issues.
1. Wi-Fi comes up on `wlan0` via DHCP using the generated `/etc/wpa_supplicant/wpa_supplicant.conf`, so make sure the SSID/PSK values are present; otherwise the interface will fail to associate.
1. After flashing the SD card once, all subsequent deployments can ride over the network: update `.env` if credentials, host IP, device name, SSH key, UI flag, or NFS flag change, rebuild, `deploy --force-update`, and reboot devices.
1. Avoid checking the `.env` file into version control—only the generated artifacts land in the build output.

---

## 13. Testing & Iteration

- Keep a spare HDMI monitor attached for first boots; check `/var/log/messages` via serial console if boot fails.
- Use `systemd-analyze` equivalent timings (or custom scripts) to profile boot time; disable services until you hit target (<5–10 seconds).
- Automate regression tests using QEMU when possible: Buildroot can run Raspberry Pi builds in QEMU for smoke checks.
- Commit configuration changes (`carputer_defconfig`, `board/carputer` custom files, package makefiles). Treat `buildroot` submodule updates as dedicated commits.

---

## 14. Maintenance Checklist

- **After Buildroot upgrades**: rerun `make oldconfig`, revalidate kernel config, rebuild images.
- **Before releases**: freeze package versions (pin git hashes), rebuild from scratch (`rm -rf output/`) to ensure reproducibility.
- **Security**: enable `br2-package-busybox show all` to confirm BusyBox version, update TLS libraries (`openssl`, `mbedtls`), run vulnerability scan on deployed rootfs if possible.
- **Backups**: store `output/images/` artifacts per release in cloud storage together with the squashfs signature.

---

## 15. Next Steps
- Implement `board/carputer/post-build.sh` to install boot video, configure splash service, and copy default configs.
- Prototype the hub app as a Qt/QML or Electron application; determine runtime requirements and add them to the Buildroot package.
- Define IPC contracts (e.g., gRPC/DBus/ZeroMQ schemas) that let companion devices or applets plug in protocol handlers such as CAN decoding without modifying the hub.
- Add automated GitHub Actions job that runs `make carputer_defconfig && make nconfig savedefconfig` to detect configuration drift.

Keep this file updated as the system evolves. Document every new dependency or kernel tweak so rebuilding the image months later is painless.

