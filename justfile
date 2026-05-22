# AwapiMindmap — task runner.
# Requires: pnpm >= 10, node >= 22, just >= 1.49.

set shell := ["bash", "-cu"]
set windows-shell := ["powershell", "-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]
set dotenv-load := true

# Default: list recipes.
default:
    @just --list

# ---- setup --------------------------------------------------------------

# Install all workspace dependencies.
install:
    pnpm install

# Remove all build/test output.
clean:
    pnpm -r exec rm -rf dist out build coverage .turbo .tsbuildinfo || true
    rm -rf release coverage playwright-report test-results

# ---- dev ----------------------------------------------------------------

# Run the desktop app in dev mode with HMR.
dev:
    pnpm --filter @awapi/mindmap-desktop dev

# ---- quality ------------------------------------------------------------

# Lint all TypeScript sources.
lint:
    pnpm lint

# Format all sources with Prettier.
fmt:
    pnpm format

# Type-check all workspaces (project references).
typecheck:
    pnpm typecheck

# ---- tests --------------------------------------------------------------

# Unit + integration tests with coverage.
test:
    pnpm test

# Vitest in watch mode.
test-watch:
    pnpm test:watch

# Open the HTML coverage report.
coverage:
    @echo "Open coverage/index.html in your browser"
    @command -v open >/dev/null && open coverage/index.html || true

# ---- build & package ----------------------------------------------------

# Build all workspaces (no installer).
build:
    pnpm build

# Package an installer for the current OS.
# Usage: just package           (current OS)
#        just package mac       (dmg+zip, x64+arm64)
#        just package win       (nsis exe + msi, x64+arm64)
#        just package linux     (AppImage+deb, x64+arm64)
package target="": build
    ./src/desktop/node_modules/.bin/electron-builder --config {{justfile_directory()}}/electron-builder.yml --projectDir src/desktop {{ if target == "" { "" } else if target == "mac" { "--mac" } else if target == "win" { "--win" } else if target == "linux" { "--linux" } else { "--" + target } }}

# Package for all platforms (CI only; requires cross-build tooling).
package-all: build
    ./src/desktop/node_modules/.bin/electron-builder --config {{justfile_directory()}}/electron-builder.yml --projectDir src/desktop -mwl

# ---- release ------------------------------------------------------------

# Bump version, tag, push, and optionally publish packages to GitHub Releases.
# Usage: just release 0.1.0           (git tag + push; CI builds)
#        just release 0.1.0 publish   (also builds and publishes installers for all platforms)
# Requires GH_TOKEN in .env when using the publish mode.
release version mode="":
    @echo "Releasing v{{version}}"
    npm version {{version}} --no-git-tag-version --allow-same-version
    pnpm -r exec npm version {{version}} --no-git-tag-version --allow-same-version
    git add -A
    git commit -m "chore: release v{{version}}"
    git tag -a "v{{version}}" -m "v{{version}}"
    git push origin main --follow-tags
    {{ if mode == "publish" { "just _publish-packages" } else { "" } }}

# (private) Build all-platform packages and upload to GitHub Releases.
_publish-packages: build
    ./src/desktop/node_modules/.bin/electron-builder --config {{justfile_directory()}}/electron-builder.yml --projectDir src/desktop -mwl --publish always
