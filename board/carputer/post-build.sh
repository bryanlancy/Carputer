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

# Add carputer user to video group for DRM access
# First, fix any malformed video group line
if grep -q '^video:' "${TARGET_DIR}/etc/group"; then
    # Get the current video group line
    VIDEO_LINE=$(grep '^video:' "${TARGET_DIR}/etc/group")
    # Check if line is malformed (GID field contains comma, which means users got mixed into GID)
    if echo "${VIDEO_LINE}" | grep -q '^video:[^:]*:[^:]*,'; then
        # Line is malformed, reconstruct it properly
        # Format should be: video:x:28:carputer
        # Extract just the GID (should be 28)
        VIDEO_GID="28"
        # Check if carputer is already in the malformed line
        if echo "${VIDEO_LINE}" | grep -q 'carputer'; then
            NEW_VIDEO_LINE="video:x:${VIDEO_GID}:carputer"
        else
            NEW_VIDEO_LINE="video:x:${VIDEO_GID}:carputer"
        fi
        sed -i "s|^video:.*|${NEW_VIDEO_LINE}|" "${TARGET_DIR}/etc/group"
        echo "[post-build] Fixed malformed video group line and added carputer user" >&2
    else
        # Line is properly formatted, just add carputer if not present
        VIDEO_USERS=$(echo "${VIDEO_LINE}" | cut -d: -f4)
        if [ -z "${VIDEO_USERS}" ]; then
            # No users, add carputer
            sed -i 's|^video:\([^:]*\):\([^:]*\):$|video:\1:\2:carputer|' "${TARGET_DIR}/etc/group"
            echo "[post-build] Added carputer user to video group for DRM access" >&2
        elif ! echo "${VIDEO_USERS}" | grep -q 'carputer'; then
            # Has users but not carputer, append it
            sed -i "s|^video:\([^:]*\):\([^:]*\):\(.*\)|video:\1:\2:\3,carputer|" "${TARGET_DIR}/etc/group"
            echo "[post-build] Added carputer user to video group for DRM access" >&2
        fi
    fi
else
    # Create video group with carputer user if it doesn't exist
    echo "video:x:28:carputer" >> "${TARGET_DIR}/etc/group"
    echo "[post-build] Created video group with carputer user" >&2
fi
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/gshadow" 2>/dev/null; then
    if [ -f "${TARGET_DIR}/etc/gshadow" ]; then
        echo "carputer:!::" >> "${TARGET_DIR}/etc/gshadow"
    fi
fi
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/passwd"; then
    echo "carputer:x:${CARPUTER_UID}:${CARPUTER_GID}:Carputer:/home/carputer:/bin/sh" >> "${TARGET_DIR}/etc/passwd"
fi
# Create carputer user with locked password (SSH key authentication only)
if ! grep -q '^carputer:' "${TARGET_DIR}/etc/shadow"; then
    # Create user with locked password (* means locked - no password login)
    echo "carputer:*:19000:0:99999:7:::" >> "${TARGET_DIR}/etc/shadow"
    echo "[post-build] Created carputer user with locked password (SSH key auth only)" >&2
else
    # Update existing user to lock password
    sed -i 's|^carputer:[^:]*:|carputer:*:|' "${TARGET_DIR}/etc/shadow"
    echo "[post-build] Locked carputer user password (SSH key auth only)" >&2
fi

install -d -m 0755 "${TARGET_DIR}/home/carputer"

install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer"
install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer/logs"
install -d -m 0755 "${TARGET_DIR}/home/carputer/.local/share/carputer/ipc"

mkdir -p "${TARGET_DIR}/usr/share/carputer"
mkdir -p "${TARGET_DIR}/var/lib/carputer"

# Ensure /var/empty exists for sshd (required for privilege separation)
mkdir -p "${TARGET_DIR}/var/empty"
chmod 755 "${TARGET_DIR}/var/empty"

# Ensure /etc/ssh exists with correct permissions for SSH host keys
mkdir -p "${TARGET_DIR}/etc/ssh"
chmod 755 "${TARGET_DIR}/etc/ssh"
chown root:root "${TARGET_DIR}/etc/ssh" 2>/dev/null || true

# Generate SSH host keys during build (not at runtime)
# This ensures keys exist with correct permissions from the start
SSH_DIR="${TARGET_DIR}/etc/ssh"
echo "[post-build] Generating SSH host keys..." >&2

# Try using host's ssh-keygen first (if available and compatible)
if command -v ssh-keygen >/dev/null 2>&1; then
    # Generate keys directly in target directory using host ssh-keygen
    # This works because SSH key format is architecture-independent
    HOST_KEYGEN=$(command -v ssh-keygen)
    for keytype in rsa ecdsa ed25519; do
        KEY_FILE="${SSH_DIR}/ssh_host_${keytype}_key"
        if [ ! -f "${KEY_FILE}" ]; then
            "${HOST_KEYGEN}" -t "${keytype}" -f "${KEY_FILE}" -N "" -C "" >/dev/null 2>&1 || {
                echo "[post-build] WARNING: Failed to generate ${keytype} key with host ssh-keygen" >&2
            }
        fi
    done
else
    echo "[post-build] WARNING: Host ssh-keygen not found, keys will be generated at runtime" >&2
fi

# Set correct permissions on all host keys (if any were generated)
if ls "${SSH_DIR}"/ssh_host_*_key >/dev/null 2>&1; then
    chmod 600 "${SSH_DIR}"/ssh_host_*_key 2>/dev/null || true
    chmod 644 "${SSH_DIR}"/ssh_host_*_key.pub 2>/dev/null || true
    chown root:root "${SSH_DIR}"/ssh_host_*_key* 2>/dev/null || true
    echo "[post-build] SSH host keys generated and permissions set" >&2
else
    echo "[post-build] WARNING: No SSH host keys found after generation attempt" >&2
fi

if [ -f "${GENERATED_WIFI_CONF}" ]; then
    # Install to Buildroot's default location: /etc/wpa_supplicant.conf
    # Use 0644 so wpa_supplicant (which may run as non-root) can read it
    install -m 0644 "${GENERATED_WIFI_CONF}" "${TARGET_DIR}/etc/wpa_supplicant.conf"
    echo "[post-build] Installed Wi-Fi profile from generated configuration at ${TARGET_DIR}/etc/wpa_supplicant.conf" >&2
else
    echo "[post-build] Warning: ${GENERATED_WIFI_CONF} not found; Wi-Fi will not be configured" >&2
fi

# Configure wlan0 directly in the main interfaces file and remove eth0
# This avoids ifupdown parsing issues and removes unused ethernet config
IFACES_FILE="${TARGET_DIR}/etc/network/interfaces"
if [ -f "${IFACES_FILE}" ]; then
    # Remove eth0 configuration (user doesn't need ethernet)
    if grep -q "^auto eth0" "${IFACES_FILE}"; then
        sed -i '/^auto eth0/,/^$/d' "${IFACES_FILE}"
        echo "[post-build] Removed eth0 configuration (not needed)" >&2
    fi

    if grep -q "^iface eth0" "${IFACES_FILE}"; then
        sed -i '/^iface eth0/,/^$/d' "${IFACES_FILE}"
        echo "[post-build] Removed eth0 iface declaration" >&2
    fi

    # Remove any existing wlan0 entries from the main interfaces file
    if grep -q "^auto wlan0" "${IFACES_FILE}"; then
        sed -i '/^auto wlan0/,/^$/d' "${IFACES_FILE}"
        echo "[post-build] Removed existing wlan0 entry from main interfaces file" >&2
    fi

    # Also check for any wlan0 iface declarations
    if grep -q "^iface wlan0" "${IFACES_FILE}"; then
        sed -i '/^iface wlan0/,/^$/d' "${IFACES_FILE}"
        echo "[post-build] Removed existing wlan0 iface declaration from main interfaces file" >&2
    fi

    # Remove source-directory line if present (we'll add it back after wlan0 if needed)
    sed -i '/^source-directory/d' "${IFACES_FILE}"

    # Add wlan0 configuration directly to the main interfaces file
    # This avoids potential parsing issues with source-directory
    {
        echo ""
        echo "auto wlan0"
        echo "iface wlan0 inet dhcp"
        echo "    wpa-conf /etc/wpa_supplicant.conf"
    } >> "${IFACES_FILE}"
    echo "[post-build] Added wlan0 configuration directly to main interfaces file" >&2

    # Verify no duplicate "auto wlan0" lines
    AUTO_COUNT=$(grep -c '^auto wlan0' "${IFACES_FILE}" 2>/dev/null || echo "0")
    if [ "${AUTO_COUNT}" -gt 1 ]; then
        echo "[post-build] ERROR: Found ${AUTO_COUNT} 'auto wlan0' lines! Fixing..." >&2
        # Keep only the first occurrence
        awk '/^auto wlan0/ && !seen++ {print; next} /^auto wlan0/ {next} {print}' "${IFACES_FILE}" > "${IFACES_FILE}.tmp" && mv "${IFACES_FILE}.tmp" "${IFACES_FILE}"
    fi

    # Verify the file doesn't have "auto auto" pattern
    if grep -qE "^auto[[:space:]]+auto" "${IFACES_FILE}" 2>/dev/null; then
        echo "[post-build] WARNING: Found 'auto auto' pattern, fixing..." >&2
        sed -i 's/^auto[[:space:]]*auto[[:space:]]*/auto /' "${IFACES_FILE}"
    fi
fi

# Remove the wlan0 file from interfaces.d since we're using the main interfaces file
# This prevents ifupdown from reading wlan0 twice (once from main file, once from interfaces.d)
WLAN0_FILE="${TARGET_DIR}/etc/network/interfaces.d/wlan0"
if [ -f "${WLAN0_FILE}" ]; then
    rm -f "${WLAN0_FILE}"
    echo "[post-build] Removed ${WLAN0_FILE} to avoid duplicate wlan0 declaration" >&2
    echo "[post-build] (wlan0 is now configured in main /etc/network/interfaces file)" >&2
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

# Require SSH public key - fail build if not provided
if [ ! -f "${GENERATED_AUTH_KEYS}" ]; then
    echo "[post-build] ERROR: SSH public key is required but not found!" >&2
    echo "[post-build] Expected: ${GENERATED_AUTH_KEYS}" >&2
    echo "[post-build] Set CARPUTER_SSH_PUBLIC_KEY in your .env file" >&2
    exit 1
fi

# Verify the key file is not empty
if [ ! -s "${GENERATED_AUTH_KEYS}" ]; then
    echo "[post-build] ERROR: SSH public key file is empty!" >&2
    echo "[post-build] File: ${GENERATED_AUTH_KEYS}" >&2
    echo "[post-build] Set CARPUTER_SSH_PUBLIC_KEY in your .env file" >&2
    exit 1
fi

# Install SSH key
install -d -m 0700 "${TARGET_DIR}/home/carputer/.ssh"
install -m 0600 "${GENERATED_AUTH_KEYS}" "${TARGET_DIR}/home/carputer/.ssh/authorized_keys"
# Use numeric UID/GID since chown can't resolve user names during build
chown -R ${CARPUTER_UID}:${CARPUTER_GID} "${TARGET_DIR}/home/carputer/.ssh"
# Ensure home directory permissions are correct for OpenSSH StrictModes
# Home directory should not be writable by group/others (but readable is OK)
chmod 755 "${TARGET_DIR}/home/carputer"
chown ${CARPUTER_UID}:${CARPUTER_GID} "${TARGET_DIR}/home/carputer"
echo "[post-build] Installed SSH authorized_keys for carputer user" >&2

# Always disable password authentication
if [ -f "${SSHD_CONFIG}" ]; then
    if grep -q '^PasswordAuthentication' "${SSHD_CONFIG}"; then
        sed -i 's/^PasswordAuthentication.*/PasswordAuthentication no/' "${SSHD_CONFIG}"
    else
        echo "PasswordAuthentication no" >> "${SSHD_CONFIG}"
    fi
    echo "[post-build] Disabled password authentication in sshd_config" >&2
else
    echo "[post-build] ERROR: ${SSHD_CONFIG} missing!" >&2
    exit 1
fi

# Ensure getty wrapper points to util-linux agetty for autologin support
if [ -x "${TARGET_DIR}/sbin/agetty" ]; then
    ln -sf /sbin/agetty "${TARGET_DIR}/sbin/getty"
fi

# Use 'once' instead of 'respawn' to prevent boot loops if UI has issues
# This allows the system to boot even if the UI fails
sed -i 's#^tty1::.*#tty1::once:/usr/bin/carputer-session#' "${TARGET_DIR}/etc/inittab"
chmod 0755 "${TARGET_DIR}/usr/bin/carputer-session"
chmod 0755 "${TARGET_DIR}/etc/init.d/rcS"

echo "[post-build] Carputer post-build hook ran" >&2
