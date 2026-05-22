# AwapiMindmap — Plan

> **Source of truth for outstanding work.** Read [`todo/README.md`](./README.md) for the workflow.
> Only tick a checkbox when the change is merged to `main`.
>
> **Style rule:** items describe **outcomes** — what the product or repo gains —
> not how to implement them. No library names, file paths, or function signatures.
> Implementation detail belongs in `docs/`.

Build **AwapiMindmap**, a cross-platform (Windows / macOS / Linux) desktop mind
map designer by Awapi. Visual canvas, node/edge editing, save/load to `.awmm`
files, dark/light theme, auto-updates from a private GitHub Releases feed.

---

## Done (Phase 0 – 1)

- [x] **Phase 0** — Persistent plan workflow (`todo/`)
- [x] **Phase 1** — Repo scaffolding: workspace layout, tooling, Electron shell,
  typed IPC surface, React renderer skeleton, CI/CD pipelines, docs

---

## Phase 2 — Core canvas interactions

- [x] Add, rename, and delete nodes on the canvas
- [x] Connect nodes by dragging between handles; delete edges
- [x] Double-click a node to edit its label in-place
- [x] Keyboard shortcut: `Delete` / `Backspace` removes the selected node(s) or edge(s)
- [x] Undo / redo for all canvas mutations (at least 50 steps)
- [x] Canvas context menu: Add Child Node, Add Sibling Node, Delete

## Phase 3 — Node styling

- [x] Per-node colour picker (background colour)
- [x] Per-node shape selector (rounded rect, ellipse, diamond)
- [x] Per-node font size control
- [x] Edge style selector (straight, curved, step)
- [x] Global theme: dark / light toggle accessible from the toolbar

## Phase 4 — File management

- [ ] New map, Open, Save, Save As wired end-to-end (menu + keyboard shortcuts)
- [ ] Recent files list (last 10) stored across sessions
- [ ] Unsaved-changes guard: prompt before New / Open / Quit when dirty
- [ ] Auto-save to a temp file every 60 seconds; recovered on next launch if the app crashed

## Phase 5 — Layout & navigation

- [ ] Auto-layout: arrange nodes in a radial tree from the root node
- [ ] Fit-to-view button and keyboard shortcut (`⌘⇧F` / `Ctrl+Shift+F`)
- [ ] Minimap shows full graph; clicking pans the viewport
- [ ] Canvas zoom via scroll wheel and pinch gesture

## Phase 6 — Export

- [ ] Export to PNG (current viewport, or full graph)
- [ ] Export to SVG
- [ ] Export to plain-text outline (indented list)
- [ ] Export to Markdown (nested list)

## Phase 7 — Collaboration & portability

- [ ] Import from Markdown (nested list → nodes)
- [ ] Copy selected subtree as JSON; paste into another map
- [ ] Shareable `.awmm` format is human-readable and stable across versions

## Phase 8 — Packaging & release engineering

- [x] Installers configured for Windows (NSIS `.exe` + `.msi`), macOS (`.dmg` + `.zip`), Linux (`.AppImage` + `.deb`); x64 and arm64
- [x] Tag-triggered release pipeline publishes to GitHub Releases
- [x] Code-signing hooks stubbed; first-launch OS warnings documented
- [ ] Auto-update: app checks on launch, downloads in the background, prompts to restart
- [ ] App icon added for all platforms

## Phase 9 — Testing

- [ ] Unit tests for canvas state logic (add/remove/rename nodes, undo/redo)
- [ ] Unit tests for file serialisation / deserialisation (round-trip fidelity)
- [ ] Coverage thresholds enforced: ≥ 80% on all logic outside Electron entry points
- [ ] End-to-end smoke test: launch app, create a node, save, reload, verify node present

---

## Verification (gates before v1.0)

- [ ] `just dev` launches the app with hot reload on Windows, macOS, and Linux
- [ ] All unit tests pass with coverage above thresholds
- [ ] Manual smoke: 500-node map renders and responds without lag
- [ ] `just package` produces installers on each host OS
- [ ] Auto-update verified end-to-end
- [ ] Export to PNG produces a pixel-accurate image on all three platforms

---

## Decisions (locked)

- **Stack:** Electron + React + TypeScript; pnpm workspaces; electron-vite
- **Canvas library:** React Flow (`@xyflow/react`)
- **State management:** Zustand (primitive selectors only)
- **File format:** `.awmm` (JSON, versioned)
- **Auto-update channel:** GitHub Releases (private repo)
- **Code signing:** deferred past v1; hooks reserved
- **Task runner:** `just`
- **Source layout:** all code under `src/`; docs under `docs/`; plan under `todo/`
