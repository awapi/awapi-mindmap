# Architecture

## Overview

AwapiMindmap is a single-window Electron app. The standard Electron three-process model is used:

```
┌─────────────────────────────────────────────────────────────────┐
│  Main process  (Node.js)                                        │
│  src/desktop/src/main/                                          │
│  • Creates BrowserWindow                                        │
│  • Builds application menu                                      │
│  • Handles IPC: file dialogs, file I/O, app info               │
│  • Auto-update via electron-updater                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ contextBridge (sandboxed)
┌────────────────────────▼────────────────────────────────────────┐
│  Preload script                                                 │
│  src/desktop/src/preload/                                       │
│  • Exposes `window.awapi` API to the renderer                   │
│  • Typed via `src/renderer/types/api.ts`                        │
└────────────────────────┬────────────────────────────────────────┘
                         │ window.awapi
┌────────────────────────▼────────────────────────────────────────┐
│  Renderer (React)                                               │
│  src/desktop/src/renderer/                                      │
│  • App.tsx — root component, wires menu events, file ops        │
│  • components/Canvas.tsx — React Flow canvas                    │
│  • state/stores.ts — Zustand stores (mindMap, theme)            │
│  • types/ — TypeScript interfaces                               │
│  • utils/ — pure helpers                                        │
└─────────────────────────────────────────────────────────────────┘
```

## IPC channels

All channel names are defined in `src/desktop/src/main/ipc.ts` as the `IpcChannel` const object.

| Channel | Direction | Purpose |
|---|---|---|
| `dialog:showOpen` | renderer → main | Show native open-file dialog |
| `dialog:showSave` | renderer → main | Show native save-file dialog |
| `fs:readFile` | renderer → main | Read a file as UTF-8 string |
| `fs:writeFile` | renderer → main | Write a UTF-8 string to a file |
| `app:getVersion` | renderer → main | Get the app version |
| `menu:newMap` | main → renderer | New Map menu triggered |
| `menu:open` | main → renderer | Open menu triggered |
| `menu:save` | main → renderer | Save menu triggered |
| `menu:saveAs` | main → renderer | Save As menu triggered |

## File format

Mind maps are saved as `.awmm` files (JSON):

```json
{
  "version": 1,
  "mindMap": {
    "id": "…",
    "title": "My Map",
    "nodes": [ { "id": "…", "label": "…", "position": { "x": 0, "y": 0 } } ],
    "edges": [ { "id": "…", "source": "…", "target": "…" } ],
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

## Build pipeline

| Tool | Role |
|---|---|
| electron-vite | Bundles main, preload, and renderer |
| Vite + @vitejs/plugin-react | Renderer dev server + HMR |
| electron-builder | Packages installers (dmg, nsis, msi, AppImage, deb) |
| TypeScript project references | Incremental type-checking |
| Vitest | Unit tests |
| ESLint + Prettier | Linting + formatting |
