# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅        |

## Reporting a vulnerability

Please report security vulnerabilities to the repository maintainer via GitHub Issues (mark as private/security if possible) or email. Do **not** post API keys, secrets, or proof-of-concept exploit code publicly.

## Security design

ZC CODE follows these principles:

- **API keys are stored separately** from config, under `~/.local/share/zc-code/auth/`, obfuscated at rest.
- **Secrets are never logged** or included in error messages (redacted).
- **Permissions are granular**: ALLOW / ASK / DENY, with tool-level, agent-level, project-level, and global overrides.
- **Destructive operations require explicit user approval** — never silently executed.
- **MCP server content is treated as untrusted** — never as privileged instructions.
- **Shell execution uses `spawn` with timeouts and working-directory restrictions.**

## Dependencies

Dependencies are pinned via `package-lock.json`. `npm audit` runs in CI.
