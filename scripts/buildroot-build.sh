#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: buildroot-build.sh [options] <command> [-- <extra-make-args>]

Automates common Buildroot tasks for the Carputer project.

Commands:
  defconfig          Reset Buildroot .config using the selected defconfig.
  build              Run a full Buildroot build (make).
  menuconfig         Launch make menuconfig (requires existing .config).
  linux-menuconfig   Launch make linux-menuconfig for kernel tweaks.
  toolchain          Build only the toolchain (make toolchain).
  legal-info         Generate licensing documentation (make legal-info).
  deploy             Rsync `output/target/` into an NFS/rootfs export.
  clean-output       Remove the Buildroot output directory (confirmation required).
  mrproper           Run make mrproper (avoids removing dl cache).

Options:
  -d, --defconfig NAME   Defconfig to apply (default: carputer_defconfig).
  -j, --jobs N           Parallel jobs to pass to make (default: host CPU count).
  -O, --output DIR       Buildroot output directory (default: buildroot/output).
  -D, --debug            Preserve build logs even when commands succeed.
      --deploy-target T  rsync destination for deploy command (or set CARPUTER_NFS_TARGET).
      --deploy-rsync-opts OPTS  additional rsync options (quote if multiple).
      --force-update    mark deploy with a force-update flag for the device.
  -y, --yes              Assume "yes" for prompts (useful for automation).
  -h, --help             Show this help message and exit.

Examples:
  ./scripts/buildroot-build.sh defconfig
  ./scripts/buildroot-build.sh build
  ./scripts/buildroot-build.sh -j 16 menuconfig
  ./scripts/buildroot-build.sh -d alternate_defconfig build -- BR2_EXTERNAL=/abs/path
EOF
}

confirm() {
  local prompt=$1
  if [[ "${ASSUME_YES:-0}" == "1" ]]; then
    return 0
  fi
  read -rp "${prompt} [y/N] " reply
  [[ "${reply}" =~ ^[Yy]$ ]]
}

log() {
  printf '[buildroot] %s\n' "$*" >&2
}

fail() {
  printf '[buildroot] ERROR: %s\n' "$*" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BUILDROOT_DIR="${REPO_ROOT}/buildroot"

[[ -d "${BUILDROOT_DIR}" ]] || fail "Expected Buildroot at ${BUILDROOT_DIR}"

DEFAULT_DEFCONFIG="carputer_defconfig"
DEFCONFIG="${DEFAULT_DEFCONFIG}"

detect_jobs() {
  if [[ -n "${JOBS:-}" ]]; then
    echo "${JOBS}"
    return
  fi
  if command -v nproc >/dev/null 2>&1; then
    nproc
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    sysctl -n hw.ncpu
  else
    echo 4
  fi
}

JOBS="$(detect_jobs)"
OUTPUT_DIR="${BUILDROOT_DIR}/output"
ASSUME_YES=0
KEEP_LOGS=0
LOG_DIR="${REPO_ROOT}/logs/buildroot"
ENABLE_LOGGING=1
DEPLOY_TARGET="${CARPUTER_NFS_TARGET:-}"
DEPLOY_RSYNC_OPTS=()
FORCE_UPDATE=0
ENV_FILE="${REPO_ROOT}/.env"
GENERATED_WIFI_CONF="${REPO_ROOT}/board/carputer/generated/wifi/wpa_supplicant.conf"
GENERATED_CMDLINE="${REPO_ROOT}/board/carputer/generated/boot/cmdline.txt"
DEFAULT_CMDLINE="${REPO_ROOT}/board/carputer/cmdline.txt"
GENERATED_HOSTNAME="${REPO_ROOT}/board/carputer/generated/etc/hostname"
GENERATED_AUTH_KEYS="${REPO_ROOT}/board/carputer/generated/ssh/authorized_keys"
GENERATED_DISABLE_UI="${REPO_ROOT}/board/carputer/generated/etc/carputer/ui.disabled"

COMMAND=""
EXTRA_MAKE_ARGS=()

prepare_wifi_config() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${GENERATED_WIFI_CONF}" ]]; then
      rm -f "${GENERATED_WIFI_CONF}"
      log "Removed generated Wi-Fi config (missing ${ENV_FILE})"
    fi
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  if [[ -z "${CARPUTER_WIFI_SSID:-}" || -z "${CARPUTER_WIFI_PSK:-}" ]]; then
    log "CARPUTER_WIFI_SSID or CARPUTER_WIFI_PSK missing in ${ENV_FILE}; skipping Wi-Fi config generation"
    return
  fi

  local ssid_escaped psk_escaped
  ssid_escaped="$(printf '%s' "${CARPUTER_WIFI_SSID}" | sed 's/"/\\"/g')"
  psk_escaped="$(printf '%s' "${CARPUTER_WIFI_PSK}" | sed 's/"/\\"/g')"

  mkdir -p "$(dirname "${GENERATED_WIFI_CONF}")"
  cat > "${GENERATED_WIFI_CONF}" <<EOF
ctrl_interface=/var/run/wpa_supplicant
ap_scan=1

network={
    ssid="${ssid_escaped}"
    psk="${psk_escaped}"
    key_mgmt=WPA-PSK
    priority=10
}
EOF
  chmod 600 "${GENERATED_WIFI_CONF}"
  log "Generated Wi-Fi config at ${GENERATED_WIFI_CONF}"
}

prepare_cmdline() {
  mkdir -p "$(dirname "${GENERATED_CMDLINE}")"

  local use_nfs="0"
  local host_ip=""

  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    use_nfs="${CARPUTER_USE_NFS:-0}"
    host_ip="${CARPUTER_HOST_IP:-}"
  fi

  local normalized
  normalized="$(printf '%s' "${use_nfs}" | tr '[:upper:]' '[:lower:]')"

  local want_nfs=0
  case "${normalized}" in
    1|true|yes|on)
      want_nfs=1
      ;;
    0|false|no|off|"")
      want_nfs=0
      ;;
    *)
      log "Unrecognized CARPUTER_USE_NFS value \"${use_nfs}\"; defaulting to SD-root cmdline"
      want_nfs=0
      ;;
  esac

  if (( want_nfs )); then
    if [[ -z "${host_ip}" ]]; then
      log "CARPUTER_USE_NFS enabled but CARPUTER_HOST_IP missing; falling back to SD-root cmdline"
      want_nfs=0
    fi
  fi

  if (( want_nfs )); then
    cat > "${GENERATED_CMDLINE}" <<EOF
console=serial0,115200 console=tty1 root=/dev/nfs rw ip=dhcp nfsroot=${host_ip}:/srv/nfs/carputer-rootfs,v3,tcp rootwait quiet loglevel=3 vt.global_cursor_default=0 splash plymouth.ignore-serial-consoles logo.nologo
EOF
    log "Generated NFS-root cmdline for host ${host_ip} at ${GENERATED_CMDLINE}"
  else
    cat > "${GENERATED_CMDLINE}" <<'EOF'
console=serial0,115200 console=tty1 root=/dev/mmcblk0p2 rw rootwait quiet loglevel=3 vt.global_cursor_default=0 splash plymouth.ignore-serial-consoles logo.nologo
EOF
    log "Generated SD-root cmdline at ${GENERATED_CMDLINE} (CARPUTER_USE_NFS=${normalized:-0})"
  fi

  # Buildroot defconfig points at board/carputer/cmdline.txt; copy generated so the image uses .env choice
  cp "${GENERATED_CMDLINE}" "${REPO_ROOT}/board/carputer/cmdline.txt"
  log "Updated board/carputer/cmdline.txt for image"
}

prepare_hostname() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${GENERATED_HOSTNAME}" ]]; then
      rm -f "${GENERATED_HOSTNAME}"
      log "Removed generated hostname (missing ${ENV_FILE})"
    fi
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  local name="${CARPUTER_DEVICE_NAME:-}"
  if [[ -z "${name}" ]]; then
    log "CARPUTER_DEVICE_NAME missing in ${ENV_FILE}; skipping hostname generation"
    return
  fi

  mkdir -p "$(dirname "${GENERATED_HOSTNAME}")"
  printf '%s\n' "${name}" > "${GENERATED_HOSTNAME}"
  log "Generated hostname ${name} at ${GENERATED_HOSTNAME}"
}

prepare_authorized_keys() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${GENERATED_AUTH_KEYS}" ]]; then
      rm -f "${GENERATED_AUTH_KEYS}"
      log "Removed generated authorized_keys (missing ${ENV_FILE})"
    fi
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  local pubkey="${CARPUTER_SSH_PUBLIC_KEY:-}"
  if [[ -z "${pubkey}" ]]; then
    if [[ -f "${GENERATED_AUTH_KEYS}" ]]; then
      rm -f "${GENERATED_AUTH_KEYS}"
      log "Removed generated authorized_keys (no key provided)"
    fi
    return
  fi

  mkdir -p "$(dirname "${GENERATED_AUTH_KEYS}")"
  printf '%s\n' "${pubkey}" > "${GENERATED_AUTH_KEYS}"
  chmod 600 "${GENERATED_AUTH_KEYS}"
  log "Generated authorized_keys at ${GENERATED_AUTH_KEYS}"
}

prepare_ui_toggle() {
  local disable_flag="${GENERATED_DISABLE_UI}"
  local enable_ui="1"

  if [[ -f "${ENV_FILE}" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "${ENV_FILE}"
    set +a
    enable_ui="${CARPUTER_ENABLE_UI:-1}"
  fi

  local normalized
  normalized="$(printf '%s' "${enable_ui}" | tr '[:upper:]' '[:lower:]')"
  case "${normalized}" in
    1|true|yes|on|"")
      if [[ -f "${disable_flag}" ]]; then
        rm -f "${disable_flag}"
        log "Removed UI disable flag (CARPUTER_ENABLE_UI=${enable_ui})"
      fi
      ;;
    0|false|no|off)
      mkdir -p "$(dirname "${disable_flag}")"
      printf '%s\n' "Set by buildroot-build.sh (CARPUTER_ENABLE_UI=${enable_ui})" > "${disable_flag}"
      log "Generated UI disable flag at ${disable_flag}"
      ;;
    *)
      log "Unknown value \"${enable_ui}\" for CARPUTER_ENABLE_UI; leaving UI enabled"
      if [[ -f "${disable_flag}" ]]; then
        rm -f "${disable_flag}"
      fi
      ;;
  esac
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    defconfig|build|menuconfig|linux-menuconfig|toolchain|legal-info|deploy|clean-output|mrproper)
      COMMAND="$1"
      shift
      EXTRA_MAKE_ARGS=("$@")
      break
      ;;
    -d|--defconfig)
      [[ $# -ge 2 ]] || fail "Missing value for $1"
      DEFCONFIG="$2"
      shift 2
      ;;
    -j|--jobs)
      [[ $# -ge 2 ]] || fail "Missing value for $1"
      JOBS="$2"
      shift 2
      ;;
    -O|--output)
      [[ $# -ge 2 ]] || fail "Missing value for $1"
      OUTPUT_DIR="$2"
      shift 2
      ;;
    -D|--debug)
      KEEP_LOGS=1
      shift
      ;;
    --deploy-target)
      [[ $# -ge 2 ]] || fail "Missing value for $1"
      DEPLOY_TARGET="$2"
      shift 2
      ;;
    --deploy-rsync-opts)
      [[ $# -ge 2 ]] || fail "Missing value for $1"
      DEPLOY_RSYNC_OPTS+=("$2")
      shift 2
      ;;
    --force-update)
      FORCE_UPDATE=1
      shift
      ;;
    -y|--yes)
      ASSUME_YES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    --)
      shift
      COMMAND="${1:-}"
      if [[ -n "${COMMAND}" ]]; then
        EXTRA_MAKE_ARGS=("${@:2}")
        break
      fi
      ;;
    -*)
      usage
      fail "Unknown option: $1"
      ;;
    *)
      COMMAND="$1"
      shift
      EXTRA_MAKE_ARGS=("$@")
      break
      ;;
  esac
done

[[ -n "${COMMAND}" ]] || {
  usage
  exit 1
}

DEFCONFIG_FILE="${BUILDROOT_DIR}/configs/${DEFCONFIG}"
if [[ ! -f "${DEFCONFIG_FILE}" ]]; then
  fail "Defconfig ${DEFCONFIG} not found at ${DEFCONFIG_FILE}"
fi

MAKE_BASE_ARGS=("O=${OUTPUT_DIR}" "-j${JOBS}")

run_make() {
  local target=$1
  shift || true
  local extra_args=("$@")
  local log_file=""
  local status=0
  local sdcard_before=""
  local sdcard_after=""
  local image_path="${OUTPUT_DIR}/images/sdcard.img"

  if [[ "${ENABLE_LOGGING}" == "1" ]]; then
    mkdir -p "${LOG_DIR}"
    local timestamp
    timestamp="$(date +%Y%m%d-%H%M%S)"
    local sanitized_target="${target//[^a-zA-Z0-9_.-]/-}"
    log_file="${LOG_DIR}/${timestamp}-${COMMAND}-${sanitized_target}.log"
    log "Streaming make output to ${log_file}"
  fi

  if [[ "${COMMAND}" == "build" && "${target}" == "all" ]]; then
    if [[ -f "${image_path}" ]]; then
      sdcard_before="$(stat -c '%Y' "${image_path}" 2>/dev/null || stat -f '%m' "${image_path}" 2>/dev/null || true)"
    else
      sdcard_before="MISSING"
    fi
  fi

  set +e
  if [[ -n "${log_file}" ]]; then
    (
      set -euo pipefail
      cd "${BUILDROOT_DIR}" >/dev/null
      make "${MAKE_BASE_ARGS[@]}" "${target}" "${extra_args[@]}" "${EXTRA_MAKE_ARGS[@]}"
    ) 2>&1 | tee "${log_file}"
    status=${PIPESTATUS[0]}
  else
    (
      set -euo pipefail
      cd "${BUILDROOT_DIR}" >/dev/null
      make "${MAKE_BASE_ARGS[@]}" "${target}" "${extra_args[@]}" "${EXTRA_MAKE_ARGS[@]}"
    )
    status=$?
  fi
  set -e

  if [[ "${COMMAND}" == "build" && "${target}" == "all" ]]; then
    if [[ -f "${image_path}" ]]; then
      sdcard_after="$(stat -c '%Y' "${image_path}" 2>/dev/null || stat -f '%m' "${image_path}" 2>/dev/null || true)"
    else
      sdcard_after="MISSING"
    fi

    if [[ "${status}" -eq 0 ]]; then
      if [[ "${sdcard_after}" == "MISSING" ]]; then
        log "Expected ${image_path} after build but could not find it."
        status=1
      elif [[ "${sdcard_before}" == "${sdcard_after}" ]]; then
        log "Build appears to have reused an existing ${image_path}; timestamp unchanged."
        status=1
      else
        log "Verified ${image_path} updated at $(date -d @"${sdcard_after}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || date -r "${image_path}" +'%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "${sdcard_after}")"
      fi
    fi
  fi

  if [[ -n "${log_file}" ]]; then
    if [[ "${status}" -eq 0 ]]; then
      if [[ "${KEEP_LOGS}" -eq 1 ]]; then
        log "Command succeeded; log retained at ${log_file}"
      else
        rm -f "${log_file}"
      fi
    else
      log "Command failed; log preserved at ${log_file}"
    fi
  fi

  return "${status}"
}

ensure_config_present() {
  if [[ ! -f "${OUTPUT_DIR}/.config" ]]; then
    log "No Buildroot .config in ${OUTPUT_DIR}. Running defconfig first."
    run_make "${DEFCONFIG}"
  fi
}

prepare_static_ip() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    if [[ -f "${GENERATED_ETH_CONF}" ]]; then
      rm -f "${GENERATED_ETH_CONF}"
      log "Removed generated eth0 config (missing ${ENV_FILE})"
    fi
    return
  fi

  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a

  local eth_ip="${CARPUTER_ETHERNET_IP:-}"
  if [[ -z "${eth_ip}" ]]; then
    if [[ -f "${GENERATED_ETH_CONF}" ]]; then
      rm -f "${GENERATED_ETH_CONF}"
      log "Removed generated eth0 config (dynamic IP)"
    fi
    return
  fi

  local eth_netmask="${CARPUTER_ETHERNET_NETMASK:-255.255.255.0}"
  local eth_gateway="${CARPUTER_ETHERNET_GATEWAY:-}"
  local eth_dns="${CARPUTER_ETHERNET_DNS:-8.8.8.8}"

  mkdir -p "$(dirname "${GENERATED_ETH_CONF}")"
  cat > "${GENERATED_ETH_CONF}" <<EOF
auto eth0
iface eth0 inet static
    address ${eth_ip}
    netmask ${eth_netmask}
EOF
  if [[ -n "${eth_gateway}" ]]; then
    cat >> "${GENERATED_ETH_CONF}" <<EOF
    gateway ${eth_gateway}
EOF
  fi
  if [[ -n "${eth_dns}" ]]; then
    cat >> "${GENERATED_ETH_CONF}" <<EOF
    dns-nameservers ${eth_dns}
EOF
  fi
  log "Generated static eth0 config at ${GENERATED_ETH_CONF}"
}

case "${COMMAND}" in
  defconfig)
    log "Applying defconfig ${DEFCONFIG}"
    run_make "${DEFCONFIG}"
    ;;
  build)
    prepare_wifi_config
    prepare_cmdline
    prepare_hostname
    prepare_authorized_keys
    prepare_ui_toggle
    ensure_config_present
    # Force carputer-ui to rebuild from apps/carputer-ui so we never ship a stale cached UI binary
    log "Cleaning carputer-ui package to avoid stale cache"
    run_make carputer-ui-dirclean
    log "Starting Buildroot build with ${JOBS} jobs"
    run_make all
    ;;
  menuconfig)
    ensure_config_present
    log "Launching menuconfig"
    run_make menuconfig
    ;;
  linux-menuconfig)
    ensure_config_present
    log "Launching linux-menuconfig"
    run_make linux-menuconfig
    ;;
  toolchain)
    ensure_config_present
    log "Building toolchain"
    run_make toolchain
    ;;
  legal-info)
    ensure_config_present
    log "Generating legal info"
    run_make legal-info
    ;;
  deploy)
    ensure_config_present
    [[ -n "${DEPLOY_TARGET}" ]] || fail "Provide --deploy-target or set CARPUTER_NFS_TARGET"
    if ! command -v rsync >/dev/null 2>&1; then
      fail "rsync is required for deploy command"
    fi
    source_dir="${OUTPUT_DIR}/target/"
    if [[ ! -d "${source_dir}" ]]; then
      fail "Expected target rootfs at ${source_dir}; run build first."
    fi
    dest="${DEPLOY_TARGET%/}/"
    log "Rsyncing ${source_dir} -> ${dest}"
    rsync -a --delete --numeric-ids --info=progress2 "${DEPLOY_RSYNC_OPTS[@]}" "${source_dir}" "${dest}"
    if [[ "${FORCE_UPDATE}" -eq 1 ]]; then
      flag_rel="var/lib/carputer/force-update"
      tmp_flag="$(mktemp)"
      date -Iseconds > "${tmp_flag}"
      rsync -a "${tmp_flag}" "${dest}${flag_rel}"
      rm -f "${tmp_flag}"
      log "Force-update flag staged at ${dest}${flag_rel}"
    fi
    log "Deploy completed to ${dest}"
    ;;
  clean-output)
    if [[ ! -d "${OUTPUT_DIR}" ]]; then
      log "Nothing to clean at ${OUTPUT_DIR}"
      exit 0
    fi
    if confirm "Remove ${OUTPUT_DIR}?"; then
      log "Removing ${OUTPUT_DIR}"
      rm -rf "${OUTPUT_DIR}"
    else
      log "Skipping output cleanup"
    fi
    ;;
  mrproper)
    log "Running make mrproper (keeps download cache)"
    run_make mrproper
    ;;
  *)
    usage
    fail "Unsupported command: ${COMMAND}"
    ;;
esac

