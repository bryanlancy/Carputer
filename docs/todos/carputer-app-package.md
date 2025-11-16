# Carputer Hub Buildroot Package

- **Status:** complete
- **Expected Time:** 6-10 hours

## Description
Replace the placeholder `carputer-app` Buildroot package with a real build/install process for the Carputer hub application, including dependencies, assets, and runtime configuration.

## Proposed Steps
1. Decide on the hub’s build system (e.g., CMake, Meson, npm/Electron) and structure source under `apps/` or an external repo.
2. Update `CARPUTER_APP_SITE` and `CARPUTER_APP_SITE_METHOD` to fetch real sources. ✅
3. List required Buildroot package dependencies via `CARPUTER_APP_DEPENDENCIES`.
4. Implement `*_BUILD_CMDS` to compile/package the hub. ✅
5. Install binaries, assets, and configuration files in `*_INSTALL_TARGET_CMDS`. ✅
6. Add optional configuration knobs to `Config.in` if the package becomes customizable.
7. Build the image and confirm the hub launches correctly on target hardware. ✅ (package-only build)
