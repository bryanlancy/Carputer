################################################################################
# Carputer Hub package
################################################################################

CARPUTER_APP_VERSION = 0.0.1
# TODO(carputer): see docs/todos/carputer-app-package.md
CARPUTER_APP_SITE = $(TOPDIR)/../apps/carputer-hub
CARPUTER_APP_SITE_METHOD = local
CARPUTER_APP_LICENSE = Proprietary
CARPUTER_APP_LICENSE_FILES =

define CARPUTER_APP_BUILD_CMDS
	$(TARGET_CC) $(TARGET_CFLAGS) -std=c11 -Wall -Wextra -Os \
		-o $(@D)/carputer-hub $(@D)/src/main.c $(TARGET_LDFLAGS)
endef

define CARPUTER_APP_INSTALL_TARGET_CMDS
	$(INSTALL) -d 0755 $(TARGET_DIR)/usr/bin
	$(INSTALL) -m 0755 $(@D)/carputer-hub $(TARGET_DIR)/usr/bin/carputer-hub
	$(INSTALL) -d 0755 $(TARGET_DIR)/usr/share/carputer
	$(INSTALL) -d 0755 $(TARGET_DIR)/usr/share/carputer/config
	$(INSTALL) -m 0644 $(@D)/data/default-config.toml $(TARGET_DIR)/usr/share/carputer/config/default-config.toml
endef

$(eval $(generic-package))
