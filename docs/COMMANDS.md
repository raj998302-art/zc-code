# Command Reference

## Global

| Command | Description |
|---------|-------------|
| `zc` | Open interactive TUI chat |
| `zc --version` | Show version |
| `zc --help` | Show help |

## Chat

| Command | Description |
|---------|-------------|
| `zc chat` | Start interactive TUI |
| `zc run "<prompt>"` | One-shot agent task |
| `zc run --agent <id> --model <id> --provider <id> "<prompt>"` | One-shot with options |
| `zc plan` | Plan Agent on current project |
| `zc build` | Build Agent on current project |
| `zc review` | Code Reviewer on current project |
| `zc fix` | Debugger on current project |

## Models

| Command | Description |
|---------|-------------|
| `zc models list [--provider <id>]` | List available models |
| `zc models add <id> --provider <id> [--name <name>] [--context <n>]` | Add a model |
| `zc models remove <id>` | Remove a model |
| `zc models use <model> [--provider <id>]` | Set default model |

## Providers

| Command | Description |
|---------|-------------|
| `zc providers list` | List configured providers |
| `zc providers add <id> [--name <name>] [--base-url <url>] [--api-key-env <env>] [--default-model <model>]` | Add a provider |
| `zc providers remove <id>` | Remove a provider |
| `zc providers enable <id>` | Enable a provider |
| `zc providers disable <id>` | Disable a provider |

## Auth

| Command | Description |
|---------|-------------|
| `zc auth login <provider>` | Store an API key |
| `zc auth logout <provider>` | Remove a stored API key |
| `zc auth list` | List providers with stored keys |

## MCP

| Command | Description |
|---------|-------------|
| `zc mcp list` | List MCP servers |
| `zc mcp add <id> [--name <name>] [--transport stdio\|http] [--command <cmd>] [--args <a,b>] [--url <url>]` | Add an MCP server |
| `zc mcp remove <id>` | Remove an MCP server |
| `zc mcp enable <id>` | Enable an MCP server |
| `zc mcp disable <id>` | Disable an MCP server |
| `zc mcp auth <id>` | Store MCP API key |

## Agent

| Command | Description |
|---------|-------------|
| `zc agent list` | List agents |
| `zc agent create` | Create a custom agent (interactive) |
| `zc agent use <id>` | Set default agent |
| `zc agent remove <id>` | Remove an agent |

## Tools

| Command | Description |
|---------|-------------|
| `zc tools list` | List built-in tools |
| `zc tools enable <name>` | Enable a tool |
| `zc tools disable <name>` | Disable a tool |

Built-in tools: read_file, write_file, edit_file, delete_file, create_directory,
list_directory, search_files, find_files, move_file, copy_file, apply_patch,
replace_text, inspect_code, analyze_project, detect_language, detect_framework,
search_symbols, execute_command, execute_script, run_tests, install_dependencies,
build_project, git_status, git_diff, git_log, git_branch, git_commit,
git_checkout, start_server, stop_server, inspect_logs, run_linter, run_formatter,
web_search, fetch_url

## Plugins

| Command | Description |
|---------|-------------|
| `zc plugins list` | List plugins |
| `zc plugins install <path>` | Install a plugin |
| `zc plugins remove <id>` | Remove a plugin |
| `zc plugins update <id>` | Update a plugin |

## Skills

| Command | Description |
|---------|-------------|
| `zc skills list` | List skills |
| `zc skills install <path>` | Install a skill |
| `zc skills create <id>` | Create a skill |

## Permissions

| Command | Description |
|---------|-------------|
| `zc permissions show` | Show current permissions |
| `zc permissions reset` | Reset to defaults |

## Sessions

| Command | Description |
|---------|-------------|
| `zc sessions list` | List sessions |
| `zc sessions resume <id>` | Resume a session (opens chat) |
| `zc sessions delete <id>` | Delete a session |

## Config

| Command | Description |
|---------|-------------|
| `zc config show` | Show configuration |
| `zc config edit` | Open config in $EDITOR |

## Maintenance

| Command | Description |
|---------|-------------|
| `zc doctor` | Diagnose installation |
| `zc update` | Check for updates |
| `zc uninstall` | Uninstall ZC CODE |

## Examples

```bash
# Add NVIDIA NIM provider
zc providers add nvidia --base-url https://integrate.api.nvidia.com/v1 --api-key-env NVIDIA_API_KEY
export NVIDIA_API_KEY=nvapi-your-key
zc models use nemotron --provider nvidia

# Run a build task
zc run "Create a REST API endpoint for user registration"

# Add an MCP server
zc mcp add context7 --transport stdio --command npx --args "-y,@context7/mcp-server"
zc mcp enable context7

# Create a custom agent
zc agent create
```
