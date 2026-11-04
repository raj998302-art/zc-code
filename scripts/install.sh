#!/usr/bin/env bash
# ZC CODE — one-command installer
# Works on Android Termux and Ubuntu/Debian Linux (ARM64 / x86_64)
#
#   curl -fsSL https://raw.githubusercontent.com/raj998302-art/zc-code/main/install.sh -o install.sh && bash install.sh
#
set -euo pipefail

REPO_OWNER="raj998302-art"
REPO_NAME="zc-code"
REPO="https://github.com/${REPO_OWNER}/${REPO_NAME}.git"
RAW_BASE="https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main"

PACKAGE_NAME="zc-code"
BIN_NAME="zc"
INSTALL_DIR="${HOME}/.local/share/${PACKAGE_NAME}"
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${HOME}/.config/${PACKAGE_NAME}"
DATA_DIR="${HOME}/.local/share/${PACKAGE_NAME}"

log()  { printf '\033[1;36m[zc]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[zc warn]\033[0m %s\n' "$*" >&2; }
err()  { printf '\033[1;31m[zc error]\033[0m %s\n' "$*" >&2; exit 1; }

detect_os() {
  if [ -n "${TERMUX_VERSION:-}" ] || [ -d "${PREFIX:-}/etc/termux" ]; then
    OS="termux"
  elif [ -f /etc/os-release ]; then
    . /etc/os-release
    OS="${ID}"
  else
    OS="linux"
  fi
}

detect_arch() {
  ARCH=$(uname -m)
  case "$ARCH" in
    aarch64|arm64) ARCH="arm64" ;;
    x86_64|amd64)  ARCH="amd64" ;;
    *)             ARCH="$ARCH" ;;
  esac
}

check_node() {
  if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
    local node_ver npm_ver
    node_ver=$(node --version | sed 's/v//')
    npm_ver=$(npm --version)
    log "Node.js ${node_ver} / npm ${npm_ver} already installed."
    return 0
  fi
  return 1
}

install_node() {
  log "Node.js/npm not found. Installing..."
  case "$OS" in
    termux)
      pkg update -y && pkg install -y nodejs npm
      ;;
    ubuntu|debian)
      if command -v apt-get >/dev/null 2>&1; then
        sudo apt-get update -y
        sudo apt-get install -y nodejs npm
      else
        err "Cannot install Node.js automatically. Please install Node.js LTS manually, then re-run."
      fi
      ;;
    *)
      err "Please install Node.js LTS (https://nodejs.org) and npm, then re-run this installer."
      ;;
  esac
}

install_zc() {
  log "Installing ${PACKAGE_NAME}..."
  mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$CONFIG_DIR" "$DATA_DIR"

  # Clone or download the repo into INSTALL_DIR
  if [ -d "${INSTALL_DIR}/.git" ]; then
    log "Existing installation found. Updating..."
    git -C "$INSTALL_DIR" pull --ff-only || true
  else
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
  fi

  cd "$INSTALL_DIR"

  # Preserve existing config
  if [ -d "$CONFIG_DIR" ] && [ -d "${INSTALL_DIR}/.config/zc-code" ]; then
    log "Preserving existing configuration."
  fi

  npm ci --omit=dev 2>/dev/null || npm install --omit=dev
  npm run build 2>/dev/null || npx tsc 2>/dev/null || true

  # Create launcher script on PATH
  cat > "$BIN_DIR/$BIN_NAME" <<LAUNCHER
#!/usr/bin/env bash
# ZC CODE launcher
exec node "${INSTALL_DIR}/dist/index.js" "\$@"
LAUNCHER
  chmod +x "$BIN_DIR/$BIN_NAME"

  log "Installed ${BIN_NAME} to ${BIN_DIR}/$BIN_NAME"
}

verify_install() {
  log "Verifying installation..."
  if command -v "$BIN_NAME" >/dev/null 2>&1 || [ -x "$BIN_DIR/$BIN_NAME" ]; then
    "$BIN_DIR/$BIN_NAME" --version
  else
    warn "$BIN_NAME not on PATH. Add ${BIN_DIR} to your PATH:"
    warn "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  fi
}

next_steps() {
  cat <<EOF

\033[1;32mZC CODE installed!\033[0m

Next steps:
  1. Ensure ${BIN_DIR} is on your PATH:
     export PATH="\${HOME}/.local/bin:\${PATH}"
  2. Configure a provider:
     zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY
  3. Store your API key:
     export OPENROUTER_API_KEY=sk-or-...
     # or: zc auth login openrouter
  4. Add a model and start:
     zc models add openrouter/gpt-4o-mini --provider openrouter
     zc models use openrouter/gpt-4o-mini --provider openrouter
     zc chat

Configuration: ${CONFIG_DIR}
Data:          ${DATA_DIR}
Docs:          https://github.com/${REPO_OWNER}/${REPO_NAME}

Run \`zc --help\` for all commands.
EOF
}

main() {
  detect_os
  detect_arch
  log "Detected: OS=${OS} ARCH=${ARCH}"

  if ! check_node; then
    install_node
  fi

  install_zc
  verify_install
  next_steps
}

main "$@"
