# Changelog

All notable changes to ZC CODE will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-04

### Added
- CLI command system: `zc`, `zc chat`, `zc run`, `zc plan/build/review/fix`, `--version`, `--help`
- Interactive TUI (Ink + React) with chat input, streaming, startup screen, help hints
- Multi-model provider engine: OpenAI-compatible (OpenRouter, NVIDIA NIM, Groq, DeepSeek, Together, Cerebras, LM Studio, custom), Anthropic, Google Gemini, Ollama
- Provider add/list/remove/enable/disable; API key login/logout/list
- Model list/add/remove/use with capability metadata (tool calling, multimodal, streaming)
- Built-in tools: file system (read/write/edit/delete/list/search/copy/move/mkdir), terminal (execute_command/execute_script), git (status/diff/log/branch/checkout), code (apply_patch/replace_text/inspect_code/search_symbols)
- Permission engine: ALLOW/ASK/DENY with global/project/agent overrides, approval prompts, audit log
- Agent system: 8 default agents (Build, Plan, Reviewer, Debugger, Researcher, Architect, Test, Docs), custom agent create/list/use/remove
- Sessions: SQLite (sql.js) persistence, list/resume/delete, message history
- Project intelligence: language/framework/package-manager/build-system/git detection
- MCP manager: client skeleton with STDIO + Streamable HTTP transports
- Plugins, skills, integrations managers (scaffolding)
- Configuration: `~/.config/zc-code/`, data `~/.local/share/zc-code/`, secrets vault separate
- One-command installer (`install.sh`) for Termux/Linux ARM64/x86_64
- GitHub Actions: CI (lint, build, test) and release automation
- Documentation: RESEARCH, ARCHITECTURE, FEATURE_MATRIX, TECH_STACK, SECURITY_DESIGN, ROADMAP

### Tested
- GitHub token authentication & repository creation
- TypeScript compilation (`tsc --noEmit`)
- Environment: Node v22.22.1, npm 9.2.0, aarch64/ARM64

### Limitations
- MCP server connections not yet end-to-end tested against real servers
- Streaming not yet wired end-to-end through TUI approval flow
- TUI approval prompt not fully functional in headless CI
