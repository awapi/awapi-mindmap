# AwapiMindmap

A cross-platform desktop mind map designer built with Electron, React, and React Flow.

## Features

- **Visual mind map canvas** — drag, connect, and organise nodes freely
- **Save / load** — persisted to `.awmm` (JSON) files
- **Dark / light theme** — stored across sessions
- **Cross-platform** — macOS (dmg/zip), Windows (nsis/msi), Linux (AppImage/deb)
- **Auto-update** — built-in electron-updater

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) ≥ 22
- [pnpm](https://pnpm.io/) ≥ 10
- [just](https://just.systems/) ≥ 1.49 (optional, for the task runner)

### Install & run

```bash
pnpm install        # or: just install
pnpm dev            # or: just dev
```

### Build

```bash
pnpm build          # transpile all packages
just package        # build + package for the current OS
just package mac    # macOS dmg + zip
just package win    # Windows nsis + msi
just package linux  # Linux AppImage + deb
```

### Quality

```bash
pnpm lint           # ESLint
pnpm typecheck      # TypeScript project references
pnpm test           # Vitest unit tests with coverage
```

## Architecture

See [docs/architecture.md](docs/architecture.md).

## License

See [LICENSE](LICENSE).
