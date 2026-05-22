# Contributing

## Setup

```bash
pnpm install
```

## Development workflow

```bash
just dev          # start the app with HMR
just lint         # ESLint
just typecheck    # TypeScript type-check
just test         # unit tests
just fmt          # Prettier format
```

## Commit style

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — tooling / maintenance
- `docs:` — documentation only

## Pull requests

Fill in the PR template. All CI checks (`lint`, `typecheck`, `test`, `build`) must pass.
