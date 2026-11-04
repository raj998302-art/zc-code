# Permissions

ZC CODE uses a granular permission system with three levels:

- **ALLOW** — always allowed
- **ASK** — prompt before each execution
- **DENY** — never allowed

## Permission levels

| Dimension | Priority |
|-----------|----------|
| Agent override | Highest |
| Project override | |
| Global default | |
| Default by category | Lowest |

## Default permissions

| Tool | Default |
|------|---------|
| read_file, list_directory, search_files | ALLOW |
| write_file, edit_file, delete_file | ASK |
| execute_command, execute_script | ASK |
| git_commit, git_push | ASK |
| install_dependencies | ASK |
| network_access | ASK |
| external_directory | DENY |

## Manage permissions

```bash
zc permissions show
zc permissions reset
```

## Approval prompts

Before dangerous operations:

```
ZC CODE wants to execute: rm -rf ./build
Permission required.
[Allow Once] [Always Allow] [Deny]
```

- Allow Once: permit this one execution
- Always Allow: permit and remember for future
- Deny: block this execution

## Security

- Destructive shell commands are NEVER silently executed
- Sensitive files (.env, secrets, keys) are protected
- External directory access is DENY by default
- All decisions are logged to the audit trail
- Path traversal (../) is blocked
