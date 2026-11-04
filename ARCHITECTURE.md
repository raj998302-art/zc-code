# ZC CODE — Architecture

## High-level data flow
```
User input
   │
   ▼
┌─────────┐     ┌──────────────┐     ┌─────────────┐
│ CLI /   │────▶│ Agent        │────▶│ Provider    │
│ TUI     │     │ Orchestrator │     │ Adapter     │
└─────────┘     └──────────────┘     └──────┬──────┘
         │                                  │
         │  tool-call request               │  HTTP (fetch)
         ▼                                  ▼
┌───────────────────────┐      ┌──────────────────────┐
│ Tool Execution Engine │─────▶│ Provider API         │
│ (permissions gate)    │      │ (OpenAI/Anthropic/..)│
└───────────────────────┘      └──────────────────────┘
         │
         ▼
┌───────────────────────┐
│ MCP Client Manager    │─────▶│ MCP servers (STDIO/HTTP)
└───────────────────────┘
         │
         ▼
┌───────────────────────┐
│ SQLite (sql.js)       │◀─────│ Sessions, metadata, audit log
└───────────────────────┘
```

## Dependency boundaries (core is independent)
- `core/` does not import any specific provider.
- `providers/` implements `ProviderAdapter` interface; registered in `ProviderRegistry`.
- `tools/` implements `Tool` interface; registered in `ToolRegistry`.
- `mcp/` implements MCP client; independent of providers.
- `agents/` uses providers + tools + MCP through interfaces.
- `plugins/` and `skills/` extend through the SDK without modifying core.
- `security/` (credential vault, redaction) used by config, providers, MCP, logging.

## Modules and responsibilities
- `cli/` — command parsing (commander), command dispatch, `--version`/`--help`.
- `tui/` — Ink components: startup panel, chat, streaming, tool indicators, approval prompts, command palette, help.
- `core/agent.ts` — AgentOrchestrator: builds system prompt, manages turn loop, calls provider, executes tool results, handles subagents.
- `core/context.ts` — context window tracking, token estimation, summarization trigger.
- `core/session.ts` — session CRUD, history, resume, export/import.
- `core/project.ts` — project intelligence (language, framework, package manager, git status, ignore rules).
- `core/toolEngine.ts` — validates input schema, checks permissions, runs tool with timeout, logs result.
- `providers/base.ts` — `ProviderAdapter` interface (chat, stream, listModels, capabilities).
- `providers/registry.ts` — provider registration, lookup, enable/disable.
- `providers/*` — per-provider adapters (OpenAI-compatible, Anthropic, Gemini, Ollama).
- `models/registry.ts` — model catalog + capability metadata (user-extensible).
- `tools/registry.ts` — tool registration, lookup, enable/disable.
- `tools/base.ts` — `Tool` interface (name, description, inputSchema, outputSchema, permission, timeout, execute).
- `tools/*` — filesystem, code, terminal, git, dev, web.
- `permissions/engine.ts` — resolve permission (global → project → agent → command), approval prompt.
- `permissions/store.ts` — persist permission decisions.
- `mcp/manager.ts` — MCP server lifecycle, connect/disconnect, reconnect.
- `mcp/client.ts` — MCP JSON-RPC client (STDIO + Streamable HTTP).
- `mcp/registry.ts` — server configs, capabilities, discovered tools/resources/prompts.
- `config/manager.ts` — read/write config, providers, models, agents; path resolution for Termux/Linux.
- `config/schema.ts` — Zod schemas for all config shapes.
- `security/credentials.ts` — secret vault (obfuscated at rest), redaction.
- `storage/database.ts` — sql.js wrapper (sessions, audit log, permissions).
- `plugins/manager.ts` — load, validate, enable/disable plugins.
- `skills/manager.ts` — skill metadata, instructions, apply to agent.
- `integrations/manager.ts` — third-party API integrations (opt-in).
- `utils/logger.ts` — redacted logging.
- `utils/tokens.ts` — token estimation, cost.
- `utils/paths.ts` — platform-appropriate config/data dirs.

## Configuration directories
- Config: `~/.config/zc-code/` (config.json, providers.json, models.json, agents/, tools/, plugins/, skills/, mcp/, permissions/, projects/)
- Data: `~/.local/share/zc-code/` (sessions/, database/, logs/, cache/)
- Auth: `~/.local/share/zc-code/auth/` (encrypted/obfuscated credentials)
- Termux/Linux: same conventions, `$XDG_CONFIG_HOME` / `$XDG_DATA_HOME` respected when set.

## Interfaces (stable)
- `ProviderAdapter`: `{ id, name, enabled, chat(options), stream(options), listModels(), capabilities() }`
- `Tool`: `{ name, description, inputSchema (Zod), outputSchema (Zod), permission, timeout, execute(args, ctx) }`
- `MCPServer`: `{ id, name, transport, command/url, env, auth, enabled, connect(), disconnect() }`
- `Agent`: `{ id, name, systemPrompt, model, tools[], mcp[], permissions[], context[] }`
- `Plugin`: `{ id, version, provides: { tools?, providers?, mcp?, hooks?, commands?, agents? } }`

## Error handling
- Provider errors normalized to `{ code, message, status, retryable }`.
- Rate limits (429) → retry with backoff (planned v0.2.0).
- Timeouts per tool and per provider request.
- MCP connection errors → status display + reconnect.
- All errors shown to user; secrets redacted.

## Testing strategy
- Unit: providers, registry, tools, permissions, MCP manager, session manager, config, credentials (mocked APIs).
- Integration: mock AI provider, MCP server connection, tool execution, file editing, shell execution, session recovery.
- E2E: install, first startup, provider config, first AI request, tool approval, file creation, agent switch, MCP connection, session continuation.
- No real paid API keys in CI.
