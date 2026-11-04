# Skills

Skills provide reusable instructions for agents. They add system prompt
instructions, suggested tools, and permissions. Skills do NOT bypass permissions.

## Example skills

- Flutter Development
- Android Development
- React Development
- Node.js Development
- Python Development
- Database Engineering
- UI/UX Design
- Code Optimization
- Security Audit
- API Development
- Game Development

## Commands

```bash
zc skills list       # List installed skills
zc skills install <path>  # Install from a directory
zc skills create <id>     # Create a skill
```

## Skill manifest (skill.json)

```json
{
  "id": "flutter-dev",
  "name": "Flutter Development",
  "version": "1.0.0",
  "description": "Flutter app development instructions",
  "instructions": "You are a Flutter expert. Use Material Design...",
  "tools": ["read_file", "write_file", "edit_file"],
  "permissions": { "writeFile": "ASK" }
}
```

## Project-specific vs global skills

Skills can be global (available to all projects) or project-specific (only
within a project directory).
