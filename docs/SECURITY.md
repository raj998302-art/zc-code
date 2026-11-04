# Security

## Secret management

- API keys stored separately from config: `~/.local/share/zc-code/auth/`
- Obfuscated at rest (XOR + base64 — deterrent, not encryption)
- Never logged, never in error messages, never in Git commits
- Redacted from all output via `redactSecret()`

## Permission levels

ALLOW / ASK / DENY with agent, project, and global overrides.

## Process safety

- Shell execution uses `spawn` (no `shell=true` with user strings)
- Working-directory restrictions
- Timeouts on every tool
- No sudo, no elevated tokens

## File protections

- `.gitignore` respected
- Sensitive files (.env, *.key, *.pem, id_*) protected
- External directory access DENY by default
- Path traversal blocked

## MCP security

- MCP content treated as untrusted data
- Never as privileged instructions
- Per-server configuration and permissions

## Audit log

All permission decisions logged with timestamp, agent, tool, decision.

## Reporting vulnerabilities

See SECURITY.md
