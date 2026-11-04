# Installation

ZC CODE installs with a single command and works on Android Termux, Ubuntu/Debian,
and other Linux systems (ARM64 / x86_64).

## One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/raj998302-art/zc-code/main/install.sh -o install.sh && bash install.sh
```

The installer:
1. Detects Termux vs Linux and ARM64 vs x86_64
2. Checks for Node.js / npm (installs if missing)
3. Clones ZC CODE into `~/.local/share/zc-code/`
4. Runs `npm ci --omit=dev` and `npm run build`
5. Creates a `zc` launcher in `~/.local/bin/`
6. Creates config/data/auth directories
7. Preserves existing configuration during updates
8. Verifies the installation

## Prerequisites

- Node.js LTS (v18 or newer) and npm
- On Termux: `pkg install nodejs npm`
- On Ubuntu/Debian: `sudo apt-get install nodejs npm`

## Verify installation

```bash
zc --version
# zc 0.1.0

zc --help
```

## First run

```bash
zc
```

This opens the interactive TUI. If no provider is configured, you'll be prompted to add one.

## Configuration directories

- Config: `~/.config/zc-code/`
- Data: `~/.local/share/zc-code/`
- Secrets: `~/.local/share/zc-code/auth/` (separate from config)

## Uninstall

```bash
bash scripts/uninstall.sh
# or
npm uninstall -g zc-code
```

Config files in `~/.config/zc-code/` are preserved.

## Installing from npm

```bash
npm install -g zc-code
zc --version
```
