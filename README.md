# Carputer

Personal project to install Raspberry Pi and Arduino to read and send commands to a car's CAN-Bus.

## Overview

The Carputer project consists of:
- **Embedded Linux System**: Custom Buildroot-based image for Raspberry Pi 4
- **Fleet Command & Control Server**: Web-based management system for device fleet

## Quick Start

### Prerequisites

1. **Environment Setup**: Copy `env.example` to `.env` and configure:
   ```bash
   cp env.example .env
   # Edit .env with your settings (Wi-Fi, hostname, SSH keys, etc.)
   ```

2. **Buildroot Dependencies** (Linux):
   - Standard build tools: `build-essential`, `bc`, `bison`, `flex`, `libssl-dev`
   - Additional: `rsync`, `wget`, `git`

   For macOS, see [Buildroot Setup Documentation](buildroot/README) for detailed prerequisites.

### Building the Carputer Image

1. **Apply defconfig** (first time or after changes):
   ```bash
   ./scripts/buildroot-build.sh defconfig
   ```

2. **Build the image**:
   ```bash
   ./scripts/buildroot-build.sh build
   ```

3. **Find the output**:
   - SD card image: `buildroot/output/images/sdcard.img`
   - Root filesystem: `buildroot/output/target/`

### Flashing to SD Card

```bash
# Replace /dev/sdX with your SD card device
sudo dd if=buildroot/output/images/sdcard.img of=/dev/sdX bs=4M status=progress
sync
```

### NFS-Root Deployment (Alternative)

For faster iteration, you can deploy the root filesystem over NFS:

1. Set `CARPUTER_USE_NFS=1` and `CARPUTER_HOST_IP=<nfs-server-ip>` in `.env`
2. Build the image (this generates NFS-root cmdline automatically)
3. Deploy to NFS share:
   ```bash
   ./scripts/buildroot-build.sh deploy --deploy-target /srv/nfs/carputer-rootfs
   ```

## Configuration

The image is customized from `.env` in two ways: (1) when you run `./scripts/buildroot-build.sh build`, the script generates WiFi, hostname, SSH keys, and cmdline from `.env` before building; (2) when you run `make` from the `buildroot/` directory, the post-build script reads `.env` and generates any missing config so the image still gets your current credentials. **After changing `.env` (e.g. new Wi‑Fi or hostname), rebuild the image and reflash or redeploy.**

Variables used:

- `CARPUTER_WIFI_SSID` - Wi-Fi network name
- `CARPUTER_WIFI_PSK` - Wi-Fi password
- `CARPUTER_HOST_IP` - NFS server IP (if using NFS-root)
- `CARPUTER_DEVICE_NAME` - Hostname for the device
- `CARPUTER_SSH_PUBLIC_KEY` - SSH public key for root access
- `CARPUTER_USE_NFS` - Enable NFS-root filesystem (0 or 1)
- `CARPUTER_ENABLE_UI` - Enable UI components (0 or 1)

For boot and UI troubleshooting (e.g. wrong display, checking what ran), see [Boot and UI debugging](docs/BOOT_DEBUGGING.md). Key logs: `/boot/carputer-session.log` and `~/.local/share/carputer/logs/carputer-ui.log` on the device.

## Fleet Command & Control Server

The Fleet CC Server provides web-based management for your Carputer devices.

### Quick Start

1. **Initial Setup**:
   ```bash
   cd fleet-cc-server
   ./setup.sh
   ```

2. **Start Services**:
   ```bash
   ./dev.sh start
   # or
   make up
   ```

3. **Run Migrations**:
   ```bash
   ./dev.sh migrate
   ```

4. **Access Services**:
   - Dashboard: http://localhost:3000
   - API: http://localhost:3001
   - Supabase Studio: http://localhost:8080

### Development Commands

```bash
./dev.sh start      # Start all services
./dev.sh stop       # Stop all services
./dev.sh restart    # Restart all services
./dev.sh logs       # Show logs
./dev.sh seed       # Seed test data
./dev.sh clean      # Remove containers and volumes
```

### Environment Configuration

The Fleet CC Server uses separate `.env` files:
- `fleet-cc-server/backend/.env` - Backend configuration
- `fleet-cc-server/frontend/.env` - Frontend configuration

See `fleet-cc-server/README.md` for detailed configuration options.

## Additional Documentation

- **[Buildroot Setup](buildroot/README)**: Detailed build instructions, configuration options, and advanced topics
- **[Fleet CC Server](fleet-cc-server/README.md)**: Complete Fleet CC Server documentation including architecture, features, and deployment

## Project Structure

```
Carputer/
├── buildroot/          # Buildroot source and configuration
├── board/carputer/     # Board-specific files (overlays, scripts)
├── fleet-cc-server/    # Fleet Command & Control web service
├── scripts/            # Build and utility scripts
├── docs/               # Additional documentation
└── .env                # Build configuration (create from env.example)
```

## Common Tasks

### Rebuild After Changes

```bash
# Incremental rebuild (recommended)
./scripts/buildroot-build.sh build

# Full clean rebuild (if needed)
./scripts/buildroot-build.sh clean-output
./scripts/buildroot-build.sh defconfig
./scripts/buildroot-build.sh build
```

### Customize Buildroot Configuration

```bash
./scripts/buildroot-build.sh menuconfig
```

### Customize Kernel Configuration

```bash
./scripts/buildroot-build.sh linux-menuconfig
```

### Deploy to NFS Share

```bash
./scripts/buildroot-build.sh deploy --deploy-target /srv/nfs/carputer-rootfs
```

## Troubleshooting

- **Build fails**: Check `logs/buildroot/` for detailed error logs
- **Image won't boot**: Verify SD card was flashed correctly and check serial console output
- **NFS-root issues**: Ensure NFS server is accessible and exports are configured correctly
- **Fleet CC Server won't start**: Check Docker is running and ports 3000, 3001, 8080 are available
