# Tools

ZC CODE has a modular tool execution engine. Every tool has a name, description,
input/output schema, validation, execution handler, permission requirement,
timeout, error handling, and logging.

Tools are **actually executed** — results are real, never faked.

## Built-in tools

### File system

| Tool | Permission | Description |
|------|-----------|-------------|
| read_file | readFile (ALLOW) | Read a file |
| write_file | writeFile (ASK) | Create or overwrite a file |
| edit_file | editFile (ASK) | Replace exact text in a file |
| delete_file | deleteFile (ASK) | Delete a file |
| create_directory | createDirectory (ASK) | Create a directory |
| list_directory | listDirectory (ALLOW) | List directory entries |
| search_files | searchFiles (ALLOW) | Search file contents |
| move_file | writeFile (ASK) | Move/rename a file |
| copy_file | writeFile (ASK) | Copy a file |

### Code

| Tool | Permission | Description |
|------|-----------|-------------|
| apply_patch | editFile (ASK) | Apply a unified diff patch |
| replace_text | editFile (ASK) | Replace text across files |
| inspect_code | readFile (ALLOW) | Inspect code structure |
| search_symbols | searchFiles (ALLOW) | Search symbol definitions |

### Terminal

| Tool | Permission | Description |
|------|-----------|-------------|
| execute_command | executeCommand (ASK) | Run a shell command |
| execute_script | executeScript (ASK) | Run a script file |

### Git

| Tool | Permission | Description |
|------|-----------|-------------|
| git_status | readFile (ALLOW) | Git working tree status |
| git_diff | readFile (ALLOW) | Git diff |
| git_log | readFile (ALLOW) | Commit history |
| git_branch | readFile (ALLOW) | List branches |
| git_checkout | gitCheckout (ASK) | Checkout branch/path |

## Permissions

Three levels: ALLOW, ASK, DENY. Before dangerous operations, ZC CODE prompts:

```
ZC CODE wants to execute: rm -rf ./build
Permission required.
[Allow Once] [Always Allow] [Deny]
```

View permissions: `zc permissions show`

## Tool execution

Tools are gated by the permission engine. The AI decides when to use tools
based on your request. Each tool execution is logged to the audit trail.
