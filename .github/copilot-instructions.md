# AwapiMindmap — Copilot Instructions

This is a cross-platform Electron desktop app for designing mind maps.

## Stack
- **Electron** with **electron-vite** for build tooling
- **React 18** + **TypeScript** in the renderer
- **Zustand** for state management
- **React Flow** (`@xyflow/react`) for the canvas/graph rendering
- **pnpm** workspaces (single package: `src/desktop`)
- **Vitest** for unit tests, **jsdom** environment for renderer tests
- **electron-builder** for packaging

## Project layout
```
src/desktop/src/
  main/       – Electron main process (Node.js)
  preload/    – Context bridge (sandboxed)
  renderer/   – React UI
    components/  – React components
    state/       – Zustand stores
    hooks/       – Custom React hooks
    types/       – TypeScript types
```

## IPC pattern
- `ipcMain.handle` / `ipcRenderer.invoke` via named channels defined in `src/desktop/src/main/ipc.ts`
- `contextBridge.exposeInMainWorld('awapi', {...})` in preload — typed via `window.awapi` declaration
- Never use `remote` module

## Conventions
- Primitive Zustand selectors (one per field) — never return object literals from selectors
- File save/load via IPC to avoid renderer FS access
- Mind map data serialised as JSON (`*.awmm` extension)

## Current implementation state

Phases 0–2 are complete. See `todo/plan.md` for the full roadmap.

**Phase 2 (Core canvas interactions) — done**

- `useMindMapStore` (in `state/stores.ts`) is the single source of truth for the mind map data. It holds a 50-step undo/redo history stack (`history` / `future`) and a `syncKey` counter. Every mutating action (add/delete/rename node, add/delete edge, sync positions) pushes a snapshot to the undo stack.
- `syncKey` increments on `undo`, `redo`, `newMap`, and `setMindMap`. `Canvas.tsx` watches `syncKey` to know when to re-sync its local React Flow state from the store; it does **not** re-sync on every `isDirty` change.
- `Canvas.tsx` wraps a `ReactFlowProvider` so the inner `CanvasFlow` component can call `useReactFlow()` (needed for `screenToFlowPosition`). The outer `Canvas` component handles the empty-map guard.
- Local React Flow state (`useNodesState` / `useEdgesState`) is kept for smooth drag UX. All semantic mutations (add, delete, rename, connect) update **both** local state and the store in one operation.
- `EditableNode.tsx` is the custom React Flow node type registered as `'editableNode'`. Double-click enters inline edit mode; Enter/blur commits; Escape cancels. Keydown events are stopped before they reach the canvas handler.
- `ContextMenu.tsx` is a positioned overlay that closes on outside pointer-down. It is rendered by `CanvasFlow` relative to the canvas wrapper (`position: fixed`).
- Canvas keyboard handling: `Delete`/`Backspace` deletes selected nodes/edges (routes through the store). `Cmd/Ctrl+Z` and `Cmd/Ctrl+Shift+Z` call `undo`/`redo`. The same undo/redo shortcuts are also registered globally in `App.tsx` via a `window` keydown listener (skips `INPUT`/`TEXTAREA` targets).
- `deleteKeyCode={null}` is set on the `ReactFlow` component — built-in deletion is disabled so all deletion is explicit and undoable.
- The canvas toolbar (inside `.canvas-wrapper`) provides Add Node, Undo, and Redo buttons. Undo/Redo are disabled when the respective stack is empty.
