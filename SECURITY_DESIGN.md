# ZC CODE — Security Design

## Threat model
- Users run ZC CODE locally (Termux / Linux / macOS) with their own provider API keys.
- AI models can request file reads/writes, shell command execution, network access, and MCP tool calls.
- MCP server descriptions and returned content are untrusted and must never be treated as privileged instructions.
- API keys and secrets must never appear in prompts, tool output, logs, error messages, or Git commits.

## Secret management
- API keys are stored separately from ordinary configuration under `~/.local/share/zc-code/auth/` (Termux: `~/.local/share/zc-code/auth/`).
- Secrets are obfuscated at rest (XOR + base64 is NOT encryption; it is a deterrent against accidental exposure, not a substitute for OS-level disk encryption). Users are advised to encrypt their home directory.
- Secrets are loaded into memory only when needed and redacted from all logging/output via `redactSecret()`.
- Provider API keys are never sent to any server other than the configured provider base URL.
- Custom integrations store credentials separately and are opt-in.

## Permission engine
Three granular levels: `ALLOW`, `ASK`, `DENY`.

| Dimension | Levels |
|-----------|--------|
| Tool-level | read_file ALLOW, write_file ASK, delete_file ASK, ... |
| Per-agent | each agent has its own permission overrides |
| Per-project | project-specific permission file |
| Global | default permissions in config |
| Per-command | dangerous commands (rm, push, install) require ASK/DENY |

Before any dangerous operation, an approval prompt is shown:
- `[Allow Once]`, `[Always Allow]`, `[Deny]`
- Destructive shell commands are NEVER silently executed.

## Process execution safety
- All shell execution uses `spawn` (never `shell=true` with user-controlled strings where avoidable).
- Working-directory restrictions: commands run inside the project root unless explicitly allowed otherwise.
- Timeouts on every tool (default 30s, configurable).
- Command validation/allowlist for destructive operations.
- Least privilege: no `sudo`, no elevated tokens.

## File & path protections
- `.gitignore` and configurable ignore rules are respected.
- Sensitive files (`.env`, `*.key`, `*.pem`, `id_*`, `secrets.*`) are protected: read requires ASK, write/delete require DENY by default.
- External directory access (outside project root) is DENY by default.
- Path traversal (`../`) is blocked via path normalization + containment checks.

## MCP security
- MCP server descriptions, tool definitions, resources, and prompts are treated as untrusted data.
- MCP tool results are not injected into the system prompt as privileged instructions; they are presented as tool output to the model.
- Each MCP server has its own configuration and permissions.
- OAuth and API-key auth supported where available; credentials stored in the secrets vault.

## Logging & audit
- Permission audit log: every ALLOW/ASK/DENY decision recorded with timestamp, tool, agent, project, and user choice.
- Tool execution history stored per session.
- Logs never contain API keys or secrets (redacted).

## Supply chain
- Dependencies pinned with lockfile (`package-lock.json`).
- `npm audit` run in CI.
- Plugins are validated (schema + signature where available) before loading; untrusted plugins require explicit user consent.

## What is NOT done
- No end-to-end encryption of sessions (future: optional local encryption key).
- No remote telemetry of API keys.
- No automatic execution of model-suggested destructive commands.
