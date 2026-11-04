# ZC CODE

**ZC CODE** — An extensible, AI-powered coding agent CLI with multi-model support, MCP integration, tools, permissions, plugins, skills, and custom agents. Built for daily use from **Android Termux + Ubuntu** (ARM64) as well as standard Linux and macOS.

Command: `zc`

[![GitHub release](https://img.shields.io/github/v/release/raj998302-art/zc-code?include_prereleases)](https://github.com/raj998302-art/zc-code/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://github.com/raj998302-art/zc-code/actions/workflows/ci.yml/badge.svg)](https://github.com/raj998302-art/zc-code/actions/workflows/ci.yml)

## One-command install

```bash
curl -fsSL https://raw.githubusercontent.com/raj998302-art/zc-code/main/install.sh -o install.sh && bash install.sh
```

Then:

```bash
zc --version
zc
```

## What it does

ZC CODE is a terminal-based AI coding agent. You talk to it in natural language and it:
- Reads, writes, edits, and deletes files (with your permission)
- Runs shell commands, tests, and build steps (with your permission)
- Operates git (status, diff, log, branch, checkout)
- Connects to MCP servers (STDIO + Streamable HTTP)
- Uses any AI model you configure (OpenAI, Anthropic, Gemini, OpenRouter, NVIDIA NIM, Groq, DeepSeek, Together, Cerebras, Ollama, LM Studio, custom OpenAI-compatible endpoints)
- Lets you create custom agents, skills, plugins, and integrations
- Remembers sessions in a local SQLite database

No account required. No paid subscription required. You bring your own API keys.

## Quick start

```bash
# 1. Install
curl -fsSL https://raw.githubusercontent.com/raj998302-art/zc-code/main/install.sh -o install.sh && bash install.sh

# 2. Add a provider (example: OpenRouter)
zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY

# 3. Store your key
export OPENROUTER_API_KEY=sk-or-...
# or
zc auth login openrouter

# 4. Add a model
zc models add openrouter/gpt-4o-mini --provider openrouter --name "GPT-4o Mini"
zc models use openrouter/gpt-4o-mini --provider openrouter

# 5. Chat
zc chat
```

Or run a one-shot task:

```bash
zc run "Create a modern login page with validation"
```

## Commands

| Command | Purpose |
|---------|---------|
| `zc` | Open interactive TUI chat |
| `zc --version` / `--help` | Version / help |
| `zc chat` | Interactive chat TUI |
| `zc run "<prompt>"` | One-shot agent task |
| `zc plan \| build \| review \| fix` | Agent shortcuts |
| `zc models <list\|add\|remove\|use>` | Manage models |
| `zc providers <list\|add\|remove\|enable\|disable>` | Manage providers |
| `zc auth <login\|logout\|list>` | Manage API keys |
| `zc mcp <list\|add\|remove\|enable\|disable\|auth>` | Manage MCP servers |
| `zc agent <list\|create\|use\|remove>` | Manage agents |
| `zc tools <list\|enable\|disable>` | Manage tools |
| `zc plugins <list\|install\|remove\|update>` | Manage plugins |
| `zc skills <list\|install\|create>` | Manage skills |
| `zc permissions <show\|reset>` | Show/reset permissions |
| `zc sessions <list\|resume\|delete>` | Manage sessions |
| `zc config <show\|edit>` | Show/edit config |
| `zc doctor` | Diagnose installation |
| `zc update` | Check for updates |
| `zc uninstall` | Uninstall |

## Configuration

ZC CODE uses XDG-compliant directories:

- Config: `~/.config/zc-code/` (config.json, providers.json, models.json, agents/, tools/, plugins/, skills/, mcp/, permissions/)
- Data: `~/.local/share/zc-code/` (sessions/, database/, logs/, cache/)
- Secrets: `~/.local/share/zc-code/auth/` (separate from config, obfuscated at rest)

API keys are never stored in config files and never logged.

## Providers

Configure any provider with `zc providers add`. Examples:

```bash
# OpenRouter
zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY

# NVIDIA NIM
zc providers add nvidia --base-url https://integrate.api.nvidia.com/v1 --api-key-env NVIDIA_API_KEY

# Ollama (local)
zc providers add ollama --base-url http://localhost:11434

# Custom OpenAI-compatible endpoint
zc providers add myendpoint --base-url https://api.example.com/v1 --api-key-env MY_KEY
```

Then add models:

```bash
zc models add openrouter/gpt-4o-mini --provider openrouter
zc models use openrouter/gpt-4o-mini --provider openrouter
```

## Permissions

Three levels: `ALLOW`, `ASK`, `DENY`. Before dangerous operations (delete, shell, git push, install), ZC CODE prompts:

```
ZC CODE wants to execute: rm -rf ./build
Permission required.
[Allow Once] [Always Allow] [Deny]
```

View permissions: `zc permissions show`

## MCP

```bash
zc mcp add context7 --transport stdio --command npx --args "-y,@context7/mcp-server"
zc mcp list
zc mcp auth github
zc mcp enable context7
```

## Termux + Ubuntu (ARM64)

Tested on ARM64. No Docker, no systemd, no graphical interface, no browser, no mandatory native dependencies.

Install Node.js in Termux first if missing:

```bash
pkg install nodejs
```

Then run the installer above.

## Documentation

- `docs/INSTALLATION.md` — installation guide
- `docs/QUICKSTART.md` — first steps
- `docs/COMMANDS.md` — full command reference
- `docs/PROVIDERS.md` — provider configuration
- `docs/MCP.md` — MCP integration
- `docs/TOOLS.md` — built-in tools
- `docs/PERMISSIONS.md` — permission system
- `docs/AGENTS.md` — agent system
- `docs/PLUGINS.md` — plugin SDK
- `docs/SKILLS.md` — skills system
- `docs/CONFIGURATION.md` — configuration reference
- `docs/SECURITY.md` — security design

## Contributing

See `CONTRIBUTING.md`.

## License

MIT. See `LICENSE`.

## Repository

https://github.com/raj998302-art/zc-code
