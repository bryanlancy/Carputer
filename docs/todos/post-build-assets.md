# Post-Build Asset Installation

- **Status:** not-started
- **Expected Time:** 3-4 hours

## Description
Extend `post-build.sh` so that splash media, default hub configuration files, permissions, and other runtime assets are staged into the target filesystem during Buildroot's post-build phase.

## Proposed Steps
1. Collect required assets (videos, images, default configs) into source control.
2. Copy assets into `${TARGET_DIR}` paths (`/usr/share/carputer`, `/etc/carputer`, etc.).
3. Apply appropriate ownership and permission tweaks for runtime services.
4. Add sanity checks/logging to detect missing assets.
5. Rebuild and verify that artifacts land in the final root filesystem.
