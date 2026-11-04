# Quickstart

Get ZC CODE running in 5 minutes.

## 1. Install

```bash
curl -fsSL https://raw.githubusercontent.com/raj998302-art/zc-code/main/install.sh -o install.sh && bash install.sh
```

## 2. Add a provider

Example with OpenRouter:

```bash
zc providers add openrouter --base-url https://openrouter.ai/api/v1 --api-key-env OPENROUTER_API_KEY
```

## 3. Store your API key

```bash
export OPENROUTER_API_KEY=sk-or-...
# or
zc auth login openrouter
```

## 4. Add and select a model

```bash
zc models add openrouter/gpt-4o-mini --provider openrouter --name "GPT-4o Mini"
zc models use openrouter/gpt-4o-mini --provider openrouter
```

Example with NVIDIA NIM:

```bash
zc providers add nvidia --base-url https://integrate.api.nvidia.com/v1 --api-key-env NVIDIA_API_KEY
export NVIDIA_API_KEY=nvapi-...
zc models add nemotron --provider nvidia
zc models use nemotron --provider nvidia
```

Example with Ollama (local, no API key needed):

```bash
zc providers add ollama --base-url http://localhost:11434
zc models add llama3.1 --provider ollama
zc models use llama3.1 --provider ollama
```

## 5. Start coding

```bash
# Interactive chat
zc chat

# One-shot task
zc run "Create a login page with email and password fields"

# Agent shortcuts
zc plan       # Plan Agent: implementation plan
zc build      # Build Agent: implement changes
zc review     # Code Reviewer: quality review
zc fix        # Debugger: fix bugs
```

## 6. Configure permissions

```bash
zc permissions show
```

Before dangerous operations (delete, shell, git push), ZC CODE prompts:
```
[Allow Once] [Always Allow] [Deny]
```

## Next steps

- `zc agent list` — see available agents
- `zc mcp list` — see MCP servers
- `zc sessions list` — see past sessions
- `zc doctor` — diagnose your installation
