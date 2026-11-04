# ZC CODE — Feature Matrix

Legend: ✅ Implemented (v0.1.0) | 🔲 Planned (v0.2.0+) | ❌ Not planned

| Category | Feature | Status | Notes |
|----------|---------|--------|-------|
| CLI | `zc` interactive TUI | ✅ | Ink-based chat |
| CLI | `zc --version` / `--help` | ✅ | commander |
| CLI | `zc run "prompt"` | ✅ | Non-interactive agent run |
| CLI | `zc plan` / `zc build` / `zc review` / `zc fix` | ✅ | Agent shortcuts |
| Providers | OpenAI-compatible (OpenRouter, NVIDIA, Groq, DeepSeek, Together, Cerebras, LM Studio, custom) | ✅ | Single adapter via fetch |
| Providers | Anthropic | ✅ | Native format |
| Providers | Google Gemini | ✅ | Native format |
| Providers | Ollama | ✅ | Native format |
| Providers | Multiple providers + API keys coexist | ✅ | Registry |
| Providers | Custom base URL, model ID, headers | ✅ | Config |
| Providers | Streaming | ✅ | SSE / fetch |
| Providers | Tool/function calling | 🔲 | Per-provider support |
| Providers | Capability detection (no false claims) | ✅ | Metadata |
| Providers | Rate limits, retries, timeouts | 🔲 | Planned v0.2.0 |
| Providers | Token usage & cost display | 🔲 | Planned v0.2.0 |
| Models | `zc models list/add/remove/use` | ✅ | Registry |
| Auth | `zc auth login/logout/list` | ✅ | Secrets vault |
| MCP | Add/remove/enable/disable/list servers | 🔲 | Planned v0.3.0 |
| MCP | STDIO + Streamable HTTP transports | 🔲 | Planned v0.3.0 |
| MCP | Tool/resource/prompt discovery | 🔲 | Planned v0.3.0 |
| Tools | read_file / write_file / edit_file / delete_file | ✅ | Filesystem tool |
| Tools | list_directory / search_files / find_files | ✅ | Filesystem tool |
| Tools | move_file / copy_file / create_directory | ✅ | Filesystem tool |
| Tools | apply_patch / replace_text | ✅ | Code tool |
| Tools | execute_command / execute_script | ✅ | Terminal tool (permission-gated) |
| Tools | git status / diff / log / branch / checkout | ✅ | Git tool |
| Tools | web_search / fetch_url | 🔲 | Planned (opt-in) |
| Permissions | ALLOW / ASK / DENY levels | ✅ | Engine |
| Permissions | Tool-level, per-agent, per-project, global | ✅ | Engine |
| Permissions | Approval prompts (Allow Once / Always / Deny) | ✅ | TUI |
| Permissions | Audit log | ✅ | Stored |
| Agents | Default agents (Build, Plan, Reviewer, Debugger, etc.) | ✅ | Built-in |
| Agents | Custom agent create/list/use/remove | ✅ | Manager |
| Agents | Per-agent model/tools/MCP/permissions | ✅ | Config |
| Agents | Subagent delegation | 🔲 | Planned v0.4.0 |
| Sessions | list/resume/delete, history, SQLite | ✅ | sql.js |
| Sessions | Context summarization, token estimation | 🔲 | Planned v0.4.0 |
| Plugins | install/list/remove/update + SDK | 🔲 | Planned v0.5.0 |
| Skills | list/install/create | 🔲 | Planned v0.5.0 |
| Project | Auto language/framework detection | ✅ | Intelligence |
| Project | .gitignore respected | ✅ | |
| Config | `~/.config/zc-code/` + secrets separate | ✅ | |
| Installer | One-command `install.sh` | ✅ | |
| Installer | Termux + Linux detect, ARM64/x86_64 | ✅ | |
| CI | GitHub Actions lint/test/build/release | ✅ | |
| Docs | Complete documentation set | ✅ | |
