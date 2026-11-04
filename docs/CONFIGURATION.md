# Configuration

## Directory layout

| Location | Purpose |
|----------|---------|
| `~/.config/zc-code/` | Configuration files |
| `~/.local/share/zc-code/` | Data (sessions, database, logs, cache) |
| `~/.local/share/zc-code/auth/` | Secrets (separate from config) |

## Config files

| File | Purpose |
|------|---------|
| `config.json` | Main configuration |
| `providers.json` | Provider configurations |
| `models.json` | Model catalog |
| `agents/agents.json` | Agent definitions |
| `tools/tools.json` | Tool enable/disable state |
| `plugins/` | Installed plugins |
| `skills/` | Installed skills |
| `mcp/servers.json` | MCP server configurations |
| `permissions/` | Permission overrides |
| `projects/` | Project-specific settings |

## Example config.json

```json
{
  "version": "0.1.0",
  "defaultProvider": "openrouter",
  "defaultModel": "openrouter/gpt-4o-mini",
  "defaultAgent": "build",
  "theme": "dark",
  "animations": true,
  "permissions": {
    "readFile": "ALLOW",
    "writeFile": "ASK",
    "executeCommand": "ASK"
  },
  "sessions": {
    "maxHistory": 200,
    "autoSummarize": true
  },
  "project": {
    "respectGitignore": true
  }
}
```

## Environment variables

- `XDG_CONFIG_HOME` — override config directory
- `XDG_DATA_HOME` — override data directory
- `LOG_LEVEL` — debug, info, warn, error
- `FORCE_COLOR` — force ANSI colors on/off
- Provider API keys: `OPENROUTER_API_KEY`, `NVIDIA_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.

## Secrets

API keys are stored separately in `~/.local/share/zc-code/auth/`, obfuscated
at rest (XOR + base64). Never committed to Git.
