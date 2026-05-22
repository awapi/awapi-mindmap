import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MindMap,
  MindMapNode,
  MindMapEdge,
  NodeShape,
  EdgeStyle,
  EdgeMarker,
} from '../types/mindmap.js';
import { nanoid } from '../utils/nanoid.js';

const MAX_HISTORY = 50;

function pushHistory(history: MindMap[], current: MindMap): MindMap[] {
  return [...history, current].slice(-MAX_HISTORY);
}

export interface MindMapState {
  /** The currently open mind map, or null when no file is loaded. */
  mindMap: MindMap | null;
  /** Path of the last saved file (undefined = never saved / new). */
  filePath: string | undefined;
  /** True when there are unsaved changes. */
  isDirty: boolean;
  /** Undo stack — up to MAX_HISTORY snapshots. */
  history: MindMap[];
  /** Redo stack. */
  future: MindMap[];
  /**
   * Increments on undo / redo / newMap / setMindMap so Canvas knows to
   * re-sync its local React Flow state from the store.
   */
  syncKey: number;

  // Core lifecycle
  newMap: () => void;
  setMindMap: (mindMap: MindMap, filePath?: string) => void;
  markSaved: (filePath: string) => void;
  markDirty: () => void;
  updateTitle: (title: string) => void;

  // Node / edge mutations (each pushes to undo history)
  addNode: (node: MindMapNode, parentEdge?: MindMapEdge) => void;
  /** Batch insert nodes + edges as a single undo snapshot (used by paste). */
  addNodes: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
  deleteNodes: (ids: string[]) => void;
  deleteEdges: (ids: string[]) => void;
  renameNode: (id: string, label: string) => void;
  addEdge: (edge: MindMapEdge) => void;
  reconnectEdge: (oldId: string, newEdge: MindMapEdge) => void;
  resizeNode: (
    id: string,
    width: number,
    height: number,
    position: { x: number; y: number },
  ) => void;
  syncPositions: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void;
  /** Batch position update that pushes a single undo snapshot (used by align / distribute). */
  setNodePositions: (updates: Array<{ id: string; position: { x: number; y: number } }>) => void;
  /** Batch size + position update that pushes a single undo snapshot (used by same-size). */
  setNodeSizes: (
    updates: Array<{
      id: string;
      width: number;
      height: number;
      position?: { x: number; y: number };
    }>,
  ) => void;
  setNodeShape: (ids: string[], shape: NodeShape) => void;
  setNodeColor: (ids: string[], color: string | undefined) => void;
  setNodeFontSize: (ids: string[], fontSize: number | undefined) => void;
  setNodeTextAlign: (ids: string[], textAlign: 'left' | 'center' | 'right' | undefined) => void;
  setEdgeStyle: (id: string, style: EdgeStyle) => void;
  setEdgeColor: (ids: string[], color: string | undefined) => void;
  setEdgeWidth: (ids: string[], width: number | undefined) => void;
  setEdgeMarkerStart: (ids: string[], marker: EdgeMarker) => void;
  setEdgeMarkerEnd: (ids: string[], marker: EdgeMarker) => void;

  // Undo / redo
  undo: () => void;
  redo: () => void;
}

function emptyMap(): MindMap {
  const rootId = nanoid();
  return {
    id: nanoid(),
    title: 'Untitled',
    nodes: [
      {
        id: rootId,
        label: 'Central Topic',
        position: { x: 0, y: 0 },
      },
    ],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

export const useMindMapStore = create<MindMapState>()((set) => ({
  mindMap: null,
  filePath: undefined,
  isDirty: false,
  history: [],
  future: [],
  syncKey: 0,

  newMap: () =>
    set((s) => ({
      mindMap: emptyMap(),
      filePath: undefined,
      isDirty: false,
      history: [],
      future: [],
      syncKey: s.syncKey + 1,
    })),

  setMindMap: (mindMap, filePath) =>
    set((s) => ({
      mindMap,
      filePath,
      isDirty: false,
      history: [],
      future: [],
      syncKey: s.syncKey + 1,
    })),

  markSaved: (filePath) => set({ filePath, isDirty: false }),

  markDirty: () => set({ isDirty: true }),

  updateTitle: (title) =>
    set((s) => ({
      mindMap: s.mindMap ? { ...s.mindMap, title } : s.mindMap,
      isDirty: true,
    })),

  addNode: (node, parentEdge) =>
    set((s) => {
      if (!s.mindMap) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: [...s.mindMap.nodes, node],
          edges: parentEdge ? [...s.mindMap.edges, parentEdge] : s.mindMap.edges,
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  addNodes: (nodesToAdd, edgesToAdd) =>
    set((s) => {
      if (!s.mindMap || nodesToAdd.length === 0) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: [...s.mindMap.nodes, ...nodesToAdd],
          edges: [...s.mindMap.edges, ...edgesToAdd],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteNodes: (ids) =>
    set((s) => {
      if (!s.mindMap) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.filter((n) => !idSet.has(n.id)),
          edges: s.mindMap.edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  deleteEdges: (ids) =>
    set((s) => {
      if (!s.mindMap) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.filter((e) => !idSet.has(e.id)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  renameNode: (id, label) =>
    set((s) => {
      if (!s.mindMap) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (n.id === id ? { ...n, label } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  addEdge: (edge) =>
    set((s) => {
      if (!s.mindMap) return {};
      // Prevent duplicate edges between the same source/target pair
      const exists = s.mindMap.edges.some(
        (e) => e.source === edge.source && e.target === edge.target,
      );
      if (exists) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: [...s.mindMap.edges, edge],
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  reconnectEdge: (oldId, newEdge) =>
    set((s) => {
      if (!s.mindMap) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (e.id === oldId ? newEdge : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  resizeNode: (id, width, height, position) =>
    set((s) => {
      if (!s.mindMap) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (n.id === id ? { ...n, width, height, position } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  syncPositions: (updates) =>
    set((s) => {
      if (!s.mindMap) return {};
      const posMap = new Map(updates.map((u) => [u.id, u.position]));
      return {
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => {
            const pos = posMap.get(n.id);
            return pos ? { ...n, position: pos } : n;
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodePositions: (updates) =>
    set((s) => {
      if (!s.mindMap || updates.length === 0) return {};
      const posMap = new Map(updates.map((u) => [u.id, u.position]));
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => {
            const pos = posMap.get(n.id);
            return pos ? { ...n, position: pos } : n;
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodeSizes: (updates) =>
    set((s) => {
      if (!s.mindMap || updates.length === 0) return {};
      const sizeMap = new Map(updates.map((u) => [u.id, u]));
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => {
            const u = sizeMap.get(n.id);
            if (!u) return n;
            return {
              ...n,
              width: u.width,
              height: u.height,
              ...(u.position ? { position: u.position } : {}),
            };
          }),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodeShape: (ids, shape) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (idSet.has(n.id) ? { ...n, shape } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodeColor: (ids, color) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (idSet.has(n.id) ? { ...n, color } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodeFontSize: (ids, fontSize) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (idSet.has(n.id) ? { ...n, fontSize } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setNodeTextAlign: (ids, textAlign) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          nodes: s.mindMap.nodes.map((n) => (idSet.has(n.id) ? { ...n, textAlign } : n)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setEdgeStyle: (id, style) =>
    set((s) => {
      if (!s.mindMap) return {};
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (e.id === id ? { ...e, edgeStyle: style } : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setEdgeColor: (ids, color) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (idSet.has(e.id) ? { ...e, strokeColor: color } : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setEdgeWidth: (ids, width) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (idSet.has(e.id) ? { ...e, strokeWidth: width } : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setEdgeMarkerStart: (ids, marker) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (idSet.has(e.id) ? { ...e, markerStart: marker } : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  setEdgeMarkerEnd: (ids, marker) =>
    set((s) => {
      if (!s.mindMap || ids.length === 0) return {};
      const idSet = new Set(ids);
      return {
        history: pushHistory(s.history, s.mindMap),
        future: [],
        mindMap: {
          ...s.mindMap,
          edges: s.mindMap.edges.map((e) => (idSet.has(e.id) ? { ...e, markerEnd: marker } : e)),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return {};
      const past = [...s.history];
      const previous = past.pop()!;
      return {
        history: past,
        future: s.mindMap ? [s.mindMap, ...s.future].slice(0, MAX_HISTORY) : s.future,
        mindMap: previous,
        isDirty: true,
        syncKey: s.syncKey + 1,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return {};
      const [next, ...rest] = s.future;
      return {
        history: s.mindMap ? [...s.history, s.mindMap].slice(-MAX_HISTORY) : s.history,
        future: rest,
        mindMap: next,
        isDirty: true,
        syncKey: s.syncKey + 1,
      };
    }),
}));

/** Theme ----------------------------------------------------------------- */

export type Theme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'awapi-mindmap-theme';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
    }),
    { name: THEME_STORAGE_KEY },
  ),
);

// ---------------------------------------------------------------------------
// Transient UI state (not persisted, not undoable)
// ---------------------------------------------------------------------------

interface UIState {
  /** ID of the node currently being edited inline, or null. */
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  editingNodeId: null,
  setEditingNodeId: (id) => set({ editingNodeId: id }),
}));
