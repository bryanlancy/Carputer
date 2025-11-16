# Raspberry Pi Firmware Configuration

- **Status:** not-started
- **Expected Time:** 2-3 hours

## Description
Tune `config.txt` for the Carputer hardware: GPU memory split, HDMI/touchscreen parameters, boot splash settings, and required device-tree overlays.

## Proposed Steps
1. Identify display, touchscreen, and peripheral requirements for each hardware SKU.
2. Set `gpu_mem`, HDMI timings, and any required `disable_splash` or boot flags.
3. Add needed `dtoverlay` entries, placing custom overlays in `board/carputer/overlays/`.
4. Validate the settings on physical hardware and update documentation with rationale.
