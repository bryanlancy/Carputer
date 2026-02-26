# Boot and UI Debugging

After boot, if the display is wrong (e.g. "row of rectangles" instead of Hello World and corner squares) or you need to see what ran, use these logs.

## Log locations (on the device)

| Log | Path | Contents |
|-----|------|----------|
| Session script | `/boot/carputer-session.log` | carputer-session startup, env, whether UI binary was found, framebuffer and UI stderr path. Written until the script redirects to tty1 and launches the UI. |
| Session (alt) | `~/.local/share/carputer/logs/session.log` | Same as above when `/boot` is not mounted or writable. |
| UI stderr | `~/.local/share/carputer/logs/carputer-ui.log` | All stderr from the carputer-ui process (Qt messages, qDebug, bootLog). |
| UI boot log | `~/.local/share/carputer/logs/carputer-ui.log` | Same file: the C++ app appends `[carputer-ui]` lines (main started, platform, screen size, showFullScreen, render calls). |

Over SSH:

```bash
# What the session script did before launching the UI
cat /boot/carputer-session.log

# What the UI process printed and whether it rendered
cat /home/carputer/.local/share/carputer/logs/carputer-ui.log
```

## Forcing the UI to rebuild

If you changed `apps/carputer-ui` but the image still shows old behavior, Buildroot may have used a cached build. Force a clean rebuild of the UI package and the image:

```bash
cd buildroot
make carputer-ui-dirclean
make
# Or use the project script:
# ./scripts/buildroot-build.sh build
```

Then reflash the SD card or redeploy the rootfs.

## What you should see when it works

- **carputer-session.log**: Lines like "carputer-session starting", "Starting Carputer Hub (carputer-ui)", "Framebuffer: present", "UI binary: ... (exists: yes)", "Redirecting stdout/stderr to tty1 and launching Carputer Hub...".
- **carputer-ui.log**: "[carputer-ui] main: carputer-ui starting (Qt C++ build)", "primaryScreen geometry WxH", "showFullScreen() done", "render() called", "drew Hello World + 4 white squares".

If you see "render() called" but never "drew Hello World + 4 white squares", the window is not exposed (e.g. linuxfb not giving expose events). If you don't see any "[carputer-ui]" lines, the binary that ran may be old or not the C++ carputer-ui.
