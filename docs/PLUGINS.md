# Plugins

ZC CODE is extensible via a plugin architecture.

## Plugin capabilities

Plugins can provide:
- Custom tools
- New providers
- MCP integrations
- Hooks
- Commands
- Custom agents

## Commands

```bash
zc plugins list       # List installed plugins
zc plugins install <path>  # Install from a directory
zc plugins remove <id>      # Remove a plugin
zc plugins update <id>      # Update a plugin
```

## Plugin manifest (plugin.json)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Example plugin",
  "main": "plugin.js",
  "provides": {
    "tools": ["my_tool"],
    "providers": ["my_provider"],
    "agents": ["my_agent"]
  }
}
```

## Plugin SDK

Plugins receive a SDK object with:
- `registerTool(def)` — register a custom tool
- `registerProvider(def)` — register a custom provider
- `registerCommand(def)` — register a CLI command
- `registerAgent(def)` — register a custom agent

## Security

- Plugins are validated before loading
- Untrusted plugins require explicit user consent
- Plugins are installed to `~/.config/zc-code/plugins/`
