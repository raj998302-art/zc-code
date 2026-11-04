# Contributing to ZC CODE

Thank you for wanting to contribute! ZC CODE is an open-source AI coding agent CLI.

## How to contribute

1. Fork the repository and create a branch: `git checkout -b feature/your-feature`
2. Make your changes
3. Run tests: `npm test`
4. Run lint/type-check: `npm run lint`
5. Run build: `npm run build`
6. Commit with a clear message and open a pull request

## Development setup

```bash
git clone https://github.com/raj998302-art/zc-code.git
cd zc-code
npm ci
npm run build
node dist/index.js --help
```

## Project structure

```
src/          # Source code (cli, core, providers, tools, mcp, agents, tui, ...)
tests/        # Unit, integration, and end-to-end tests
docs/         # Documentation
scripts/      # install.sh, uninstall.sh
.github/      # GitHub Actions workflows
```

## Code style

- TypeScript strict mode
- Prefer pure-JavaScript / WASM dependencies (Termux-safe)
- No hardcoded API keys or models
- All secrets go through the credentials vault (`src/security/credentials.ts`)

## Security

Never commit API keys or secrets. See `SECURITY.md`.

## Releases

Maintainers cut releases via GitHub tags. Semantic versioning is used.
