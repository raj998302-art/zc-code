# MCP Integration

Model Context Protocol (MCP) lets ZC CODE connect to external servers that
provide tools, resources, and prompts.

## Supported transports

- **STDIO** — local server started as a subprocess
- **Streamable HTTP** — remote HTTP-based MCP server

## Manage MCP servers

```bash
# List servers
zc mcp list

# Add a local STDIO server
zc mcp add context7 --name "Context7" --transport stdio --command npx --args "-y,@context7/mcp-server"

# Add a remote HTTP server
zc mcp add github --name "GitHub" --transport http --url https://api.github.com/mcp

# Enable/disable
zc mcp enable context7
zc mcp disable context7

# Authenticate
zc mcp auth github

# Remove
zc mcp remove context7
```

## Security

- MCP server descriptions and returned content are treated as **untrusted data**
- Never treated as privileged instructions
- Each server has its own configuration and permissions
- API keys stored in the secrets vault (separate from config)
- OAuth supported where available

## Example: Context7

```bash
zc mcp add context7 --transport stdio --command npx --args "-y,@context7/mcp-server"
zc mcp enable context7
```

## Example: GitHub

```bash
zc mcp add github --transport http --url https://api.github.com/mcp
zc mcp auth github
# Enter your GitHub personal access token
zc mcp enable github
```
