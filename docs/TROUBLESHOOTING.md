# Troubleshooting

## Installation

**Node.js not found:**
```bash
# Termux
pkg install nodejs npm

# Ubuntu/Debian
sudo apt-get install nodejs npm
```

**`zc: command not found`:**
Add `~/.local/bin` to your PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Providers

**401 Unauthorized:** Check your API key is set:
```bash
export OPENROUTER_API_KEY=sk-or-...
# or
zc auth login openrouter
```

**Model not found:** Add the model first:
```bash
zc models add <model-id> --provider <provider>
zc models use <model-id> --provider <provider>
```

## Permissions

**Tool blocked:** Check permissions:
```bash
zc permissions show
```
The tool may require ASK — respond to the approval prompt.

## TUI

**TUI won't start:** Ink requires a TTY. Make sure you're running in an
interactive terminal, not piped output.

**Colors not working:** Set `FORCE_COLOR=1` or check terminal color support.

## Database

**sql.js not available:** Falls back to JSON storage automatically. Sessions
still work, just without SQLite performance.

## Debug

```bash
zc doctor
LOG_LEVEL=debug zc run "test"
```
