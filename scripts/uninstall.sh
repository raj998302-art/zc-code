#!/usr/bin/env bash
# ZC CODE — uninstall script
set -euo pipefail

BIN_NAME="zc"
PACKAGE_NAME="zc-code"
INSTALL_DIR="${HOME}/.local/share/${PACKAGE_NAME}"
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.config/${PACKAGE_NAME}"
DATA_DIR="${HOME}/.local/share/${PACKAGE_NAME}"

log() { printf '\033[1;36m[zc]\033[0m %s\n' "$*"; }

echo "This will remove ZC CODE from ${INSTALL_DIR}"
echo "Configuration in ${CONFIG_DIR} will be preserved."
read -rp "Continue? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo "Aborted."
  exit 0
fi

rm -f "${BIN_DIR}/${BIN_NAME}"
rm -rf "$INSTALL_DIR"
log "ZC CODE uninstalled."
log "Config preserved at ${CONFIG_DIR}. Remove manually if desired."
