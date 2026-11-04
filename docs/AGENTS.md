# Agents

ZC CODE has a multi-agent architecture. Each agent has a custom system prompt,
model selection, tools, MCP access, permissions, and context.

## Default agents

| Agent | Description |
|-------|-------------|
| build | Implement features, write code, ship changes |
| plan | Break down tasks, create plans, estimate effort |
| reviewer | Review code for quality, bugs, best practices |
| debugger | Diagnose and fix bugs |
| researcher | Research technologies, APIs, best practices |
| architect | Design system structure, module boundaries |
| test | Write and run tests |
| docs | Write and update documentation |

## Manage agents

```bash
zc agent list
zc agent create          # Interactive: id, name, system prompt, model
zc agent use <id>        # Set default agent
zc agent remove <id>
```

## Custom agent

Each agent can have:
- Custom system prompt
- Custom model (different per agent)
- Custom tools
- Custom MCP servers
- Custom permissions
- Custom context
- Agent-specific memory

## Subagent delegation

The main agent can coordinate subagents (research, architect, coding, testing),
collect results, and report progress. Subagents with conflicting changes are
not run in parallel.

## Example: Android Developer agent

```
Name: Android Developer
Model: NVIDIA Nemotron
Tools: file system, terminal, git, Android build tools
Permissions: Read=Allow, Edit=Ask, Shell=Ask
```
