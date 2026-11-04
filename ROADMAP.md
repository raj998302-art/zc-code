# ZC CODE — Roadmap

## v0.1.0 — First usable release (MVP)
- CLI command system: `zc`, `zc chat`, `zc run`, `zc --version`, `zc --help`
- TUI startup screen + chat input + streaming responses
- Multi-model provider engine: OpenAI-compatible (OpenRouter, NVIDIA NIM, Groq, DeepSeek, Together, Cerebras, LM Studio, custom), Anthropic, Gemini, Ollama
- Provider add/list/remove/use; API key login/logout; model list/use/switch
- Built-in tools: file read/write/edit/delete, list/search, terminal execute (with permission), git status/diff/log
- Permission engine: ALLOW/ASK/DENY, tool-level + global, approval prompts
- Sessions: SQLite (sql.js) persistence, list/resume/delete, history
- Config: `~/.config/zc-code/`, secrets in `~/.local/share/zc-code/auth/`
- Project intelligence: language/framework detection, .gitignore respected
- Installer: `install.sh` (Termux/Linux detect, Node check, PATH, config dirs, verify)
- GitHub Actions: lint, type-check, unit tests, build, release, checksums
- Docs: README, INSTALLATION, QUICKSTART, COMMANDS, PROVIDERS, MCP, TOOLS, PERMISSIONS, CONFIG, SECURITY

## v0.2.0 — Provider and model expansion
- Structured responses / tool calling per provider
- Capability detection (tool calling, multimodal) respected per model
- Rate-limit handling, retries, timeouts, token usage/cost display
- Custom model IDs and base URLs

## v0.3.0 — MCP manager
- MCP STDIO + Streamable HTTP servers
- Add/remove/enable/disable/list/auth
- Tool/resource/prompt discovery, execution, connection status, logs
- Secure MCP registry

## v0.4.0 — Agent and permissions system
- Default agents: Build, Plan, Code Reviewer, Debugger, Research, Architect, Test, Documentation
- Custom agent create/list/use/remove; per-agent model, tools, MCP, permissions, context
- Subagent delegation (main agent coordinates)
- Per-agent and per-project permissions

## v0.5.0 — Plugin and skills system
- Plugin SDK: custom tools, providers, MCP integrations, hooks, commands, agents
- `zc plugins install/list/remove/update`
- Skills: Flutter, Android, React, Node.js, Python, Database, UI/UX, Optimization, Security Audit, API, Game
- `zc skills list/install/create`

## v1.0.0 — Stable production release
- All essential features pass tests
- ARM64 + Termux verified
- Full documentation complete
- Stable internal interfaces for providers, agents, tools, plugins, MCP

## Future (post-1.0)
- Custom local/hosted models, custom inference endpoints, model adapters
- Model routing, fallback models, multi-model workflows, benchmarking
- Custom agent marketplace, plugin marketplace, shared config profiles
- Optional local encryption of secrets/sessions
