# Boot Splash and Hub Launch

- **Status:** not-started
- **Expected Time:** 6-8 hours

## Description
Implement the early init script that presents a splash or boot video, launches the Carputer hub process, exposes IPC endpoints for applets, and tears down the splash once the hub is ready.

## Proposed Steps
1. Package splash assets (image or video) into the rootfs overlay.
2. Update `S05carputer` to spawn the splash player and track its PID.
3. Launch the real `carputer-hub` binary with necessary environment variables.
4. Create and permission the IPC directory (e.g., `/var/run/carputer`) and publish sockets or bus names.
5. Poll for hub readiness; once confirmed, stop the splash player cleanly.
6. Add logging/error handling and test boot timing on hardware.
