# ZC CODE — Technology Stack

## Guiding principles
- **Termux + Ubuntu on ARM64 (aarch64) is the primary target.** Every dependency must install and run cleanly on Android Termux without Docker, systemd, a graphical interface, a browser, or mandatory native build steps.
- **Zero mandatory native dependencies.** Prefer pure-JavaScript / WASM packages so `npm install` succeeds in Termux without `build-essential`, `python`, or `make`.
- **No Firebase, no proprietary backend, no paid subscription required.** Users bring their own provider API keys.
- **Modular, typed, schema-validated.** Clear interfaces and dependency boundaries so providers, tools, agents, MCP servers, plugins, and skills can be added without rewriting core.

## Runtime & language
| Layer | Choice | Rationale |
|-------|--------|-----------|
| Runtime | Node.js LTS (v20 / v22) | Preinstalled or easily installable in Termux (`pkg install nodejs`) |
| Language | TypeScript 5.x | Static types, maintainable large codebase |
| Package manager | npm | Universal, works in Termux |
| Module system | ESM (`"type": "module"`) | Modern, tree-shakable |
| Binary | `zc` (Node script with shebang) | Single executable on PATH |

## Core dependencies (all pure-JS / WASM, Termux-safe)
| Package | Purpose | Native? | Termux ARM64 |
|---------|---------|---------|--------------|
| zod | Schema validation for config, tools, providers | No | Yes |
| sql.js | SQLite in pure JS + WASM (sessions, metadata) | No (WASM) | Yes |
| ink | React-based terminal UI | No | Yes* |
| react | UI framework for Ink | No | Yes |
| commander | CLI command definition | No | Yes |
| chalk | Terminal colors (supports color detection) | No | Yes |
| boxen | Boxes/panels in terminal | No | Yes |
| ora | Spinners | No | Yes |
| cli-spinners | Spinner frames | No | Yes |
| figlet | ASCII banners (startup) | No | Yes |
| prompts | Interactive prompts (multiline input, selection) | No | Yes |
| node:fetch / undici | HTTP client (built into Node 18+) | No (builtin) | Yes |
| @modelcontextprotocol/sdk | MCP client (official SDK) | No | Yes |
| zod | Validation | No | Yes |

\* Ink is well tested in Termux; terminal resize and small-screen handling are implemented defensively. ASCII fallbacks provided for icons.

## Optional / conditional dependencies
| Package | Purpose | Notes |
|---------|---------|-------|
| better-sqlite3 | Faster SQLite (native) | Optional upgrade; NOT required. Falls back to sql.js. |

## Dependencies deliberately AVOIDED
- **Docker / systemd / graphical UI / browser** — not required.
- **Firebase** — forbidden by product requirements.
- **x86-only binaries** — no native arch-specific packages.
- **Unnecessary native modules** — avoided to keep `npm install` reliable in Termux.

## Provider adapters (built-in, no provider SDKs required)
All providers are called directly via `node:fetch` and normalized to a unified interface:
- OpenAI (OpenAI-compatible)
- Anthropic
- Google Gemini
- OpenRouter (OpenAI-compatible)
- NVIDIA NIM (OpenAI-compatible)
- Groq (OpenAI-compatible)
- DeepSeek (OpenAI-compatible)
- Together AI (OpenAI-compatible)
- Cerebras (OpenAI-compatible)
- Mistral
- Ollama
- LM Studio (OpenAI-compatible)
- Custom OpenAI-compatible endpoints

## Build & publish
- TypeScript compiler (`tsc`) — type check + emit to `dist/`
- GitHub Actions — lint, test, build, package, release, checksums
- npm package — versioned releases with proper namespace
- GitHub Releases — assets + checksums (SHA-256)

## File layout (source)
```
src/
  cli.ts               # commander entry + command registry
  index.ts             # bin entry (zc)
  commands/            # one file per top-level command
  core/                # agent, context, session, project, toolEngine
  providers/           # base interface, registry, per-provider adapters
  models/              # model registry + capability metadata
  agents/              # agent manager + default agents
  tools/               # tool registry + base + category implementations
  permissions/         # permission engine + store
  mcp/                 # MCP client manager + registry + transports
  plugins/             # plugin manager + SDK
  skills/              # skills manager
  sessions/            # session persistence
  memory/              # context summarization + token estimation
  context/             # project intelligence
  config/              # config manager + schema
  security/            # credential storage + redaction
  storage/             # database abstraction (sql.js)
  tui/                 # Ink components (chat, startup, panels)
  integrations/        # third-party integration manager
  utils/               # logger, tokens, paths, spinner
tests/
docs/
scripts/               # install.sh, uninstall.sh
.github/workflows/
```
