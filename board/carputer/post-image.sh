#!/bin/sh
set -e

BOARD_DIR="$(dirname "$0")"
BOARD_NAME="$(basename "${BOARD_DIR}")"
GENIMAGE_CFG="${BOARD_DIR}/genimage-${BOARD_NAME}.cfg"
GENIMAGE_TMP="${BUILD_DIR}/genimage.tmp"

# Use board-specific genimage config template if available
if [ ! -e "${GENIMAGE_CFG}" ]; then
	GENIMAGE_CFG="${BINARIES_DIR}/genimage.cfg"
	FILES=

	for i in "${BINARIES_DIR}"/*.dtb "${BINARIES_DIR}"/rpi-firmware/*; do
		[ -e "$i" ] || continue
		FILES="${FILES}$(printf '\t\t\t"%s",\n' "${i#${BINARIES_DIR}/}")"
	done

	KERNEL=$(sed -n 's/^kernel=//p' "${BINARIES_DIR}/rpi-firmware/config.txt")
	if [ -n "${KERNEL}" ]; then
		FILES="${FILES}$(printf '\t\t\t"%s",\n' "${KERNEL}")"
	fi

	sed "s|#BOOT_FILES#|${FILES}|" "${BOARD_DIR}/genimage.cfg.in" > "${GENIMAGE_CFG}"
fi

# Override firmware config and cmdline with board-specific settings
CMDLINE_SRC="${BOARD_DIR}/cmdline.txt"
CUSTOM_CMDLINE="${BOARD_DIR}/generated/boot/cmdline.txt"
if [ -f "${CUSTOM_CMDLINE}" ]; then
	CMDLINE_SRC="${CUSTOM_CMDLINE}"
fi

cp "${BOARD_DIR}/config.txt" "${BINARIES_DIR}/rpi-firmware/config.txt"
cp "${BOARD_DIR}/config.txt" "${BINARIES_DIR}/config.txt"
cp "${CMDLINE_SRC}" "${BINARIES_DIR}/rpi-firmware/cmdline.txt"
cp "${CMDLINE_SRC}" "${BINARIES_DIR}/cmdline.txt"

GENERATED_HOSTNAME="${BOARD_DIR}/generated/etc/hostname"
if [ -f "${GENERATED_HOSTNAME}" ]; then
	cp "${GENERATED_HOSTNAME}" "${BINARIES_DIR}/rpi-firmware/hostname"
	cp "${GENERATED_HOSTNAME}" "${BINARIES_DIR}/hostname"
fi


trap 'rm -rf "${ROOTPATH_TMP}"' EXIT
ROOTPATH_TMP="$(mktemp -d)"

rm -rf "${GENIMAGE_TMP}"

"${HOST_DIR}/bin/genimage" \
	--rootpath "${ROOTPATH_TMP}" \
	--tmppath "${GENIMAGE_TMP}" \
	--inputpath "${BINARIES_DIR}" \
	--outputpath "${BINARIES_DIR}" \
	--config "${GENIMAGE_CFG}"

printf '[post-image] Carputer post-image hook ran on %s\n' "${BINARIES_DIR}" >&2
