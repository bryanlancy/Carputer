#!/bin/sh
set -e

# board/carputer/post-build.sh
# Hook for tweaking the target root filesystem after Buildroot staging.
# TODO(carputer): see docs/todos/post-build-assets.md

TARGET_DIR="$1"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GENERATED_WIFI_CONF="${SCRIPT_DIR}/generated/wifi/wpa_supplicant.conf"
GENERATED_DISABLE_UI="${SCRIPT_DIR}/generated/etc/carputer/ui.disabled"

CARPUTER_UID=1000
CARPUTER_GID=1000

# Ensure carputer user and group exist for autologin
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/group"; then
    echo "carputer:x:${CARPUTER_GID}:" >> "${TARGET_DIR}/etc/group"
fi
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/gshadow" 2>/dev/null; then
    if [ -f "${TARGET_DIR}/etc/gshadow" ]; then
        echo "carputer:!::" >> "${TARGET_DIR}/etc/gshadow"
    fi
fi
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/passwd"; then
    echo "carputer:x:${CARPUTER_UID}:${CARPUTER_GID}:Carputer:/home/carputer:/bin/sh" >> "${TARGET_DIR}/etc/passwd"
fi
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/shadow"; then
    echo "carputer::19000:0:99999:7:::" >> "${TARGET_DIR}/etc/shadow"
fi

install -d -m 0755 "${TARGET_DIR}/home/carputer"

install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer"
install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer/logs"
install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer/ipc"

mkdir -p "${TARGET_DIR}/usr/share/carputer"
mkdir -p "${TARGET_DIR}/var/lib/carputer"

if [ -f "${GENERATED_WIFI_CONF}" ]; then
    install -D -m 0600 "${GENERATED_WIFI_CONF}" "${TARGET_DIR}/etc/wpa_supplicant/wpa_supplicant.conf"
    echo "[post-build] Installed Wi-Fi profile from generated configuration" >&2
fi

# Ensure ifupdown pulls in per-interface snippets (wlan0 DHCP config)
IFACES_FILE="${TARGET_DIR}/etc/network/interfaces"
if [ -f "${IFACES_FILE}" ] && ! grep -q '^source-directory /etc/network/interfaces.d' "${IFACES_FILE}"; then
    printf '\nsource-directory /etc/network/interfaces.d\n' >> "${IFACES_FILE}"
    echo "[post-build] Enabled interfaces.d sourcing for ifupdown" >&2
fi

GENERATED_HOSTNAME="${SCRIPT_DIR}/generated/etc/hostname"
if [ -f "${GENERATED_HOSTNAME}" ]; then
    install -D -m 0644 "${GENERATED_HOSTNAME}" "${TARGET_DIR}/etc/hostname"
    echo "[post-build] Installed hostname from generated configuration" >&2
fi

DISABLE_UI_FLAG="${TARGET_DIR}/etc/carputer/ui.disabled"
if [ -f "${GENERATED_DISABLE_UI}" ]; then
    # Explicitly create the directory first
    mkdir -p "${TARGET_DIR}/etc/carputer"
    install -m 0644 "${GENERATED_DISABLE_UI}" "${DISABLE_UI_FLAG}"
    echo "[post-build] UI session disabled via generated flag at ${DISABLE_UI_FLAG}" >&2
else
    # Remove the flag if it exists, but keep the directory
    rm -f "${DISABLE_UI_FLAG}"
    echo "[post-build] UI session enabled (no disable flag found)" >&2
fi

GENERATED_AUTH_KEYS="${SCRIPT_DIR}/generated/ssh/authorized_keys"
SSHD_CONFIG="${TARGET_DIR}/etc/ssh/sshd_config"
if [ -f "${GENERATED_AUTH_KEYS}" ]; then
    install -D -m 0700 "${TARGET_DIR}/home/carputer/.ssh"
    install -D -m 0600 "${GENERATED_AUTH_KEYS}" "${TARGET_DIR}/home/carputer/.ssh/authorized_keys"
    chown -R carputer:carputer "${TARGET_DIR}/home/carputer/.ssh"
    if [ -f "${SSHD_CONFIG}" ]; then
        if grep -q '^PasswordAuthentication' "${SSHD_CONFIG}"; then
            sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
        else
            echo "PasswordAuthentication no" >> "${SSHD_CONFIG}"
        fi
    else
        echo "[post-build] Warning: ${SSHD_CONFIG} missing; skipping password disable." >&2
    fi
    echo "[post-build] Installed SSH authorized_keys and disabled password authentication" >&2
else
    if [ -f "${SSHD_CONFIG}" ]; then
        if grep -q '^PasswordAuthentication' "${SSHD_CONFIG}"; then
            sed -i 's/^PasswordAuthentication.*/PasswordAuthentication yes/' "${SSHD_CONFIG}"
        else
            echo "PasswordAuthentication yes" >> "${SSHD_CONFIG}"
        fi
    fi
    echo "[post-build] No SSH key provided; password authentication remains enabled" >&2
fi

# Ensure getty wrapper points to util-linux agetty for autologin support
if [ -x "${TARGET_DIR}/sbin/agetty" ]; then
    ln -sf /sbin/agetty "${TARGET_DIR}/sbin/getty"
fi

sed -i 's#^tty1::.*#tty1::respawn:/usr/bin/carputer-session#' "${TARGET_DIR}/etc/inittab"
chmod 0755 "${TARGET_DIR}/usr/bin/carputer-session"
chmod 0755 "${TARGET_DIR}/etc/init.d/rcS"

echo "[post-build] Carputer post-build hook ran" >&2
