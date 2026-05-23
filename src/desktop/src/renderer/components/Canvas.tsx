import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import type { JSX } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
  MarkerType,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  applyNodeChanges,
  applyEdgeChanges,
  reconnectEdge as rfReconnectEdge,
  type Connection,
  type Node,
  type Edge,
  type EdgeMarkerType,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMindMapStore, useThemeStore, useUIStore } from '../state/stores.js';
import { EditableNode } from './EditableNode.js';
import { StickyNote } from './StickyNote.js';
import { CommentNode } from './CommentNode.js';
import { ContextMenu } from './ContextMenu.js';
import { ShapePicker } from './ShapePicker.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import { NodeFormattingToolbar } from './NodeFormattingToolbar.js';
import { EdgeFormattingToolbar } from './EdgeFormattingToolbar.js';
import { computeRadialLayout } from '../utils/layout.js';
import { toPlainText, toMarkdown } from '../utils/export.js';
import type { ActiveTool, ExportType } from './CanvasToolbar.js';
import type { ContextMenuAction } from './ContextMenu.js';
import type { MindMapNode, MindMapEdge, NodeShape, EdgeMarker } from '../types/mindmap.js';
import { nanoid } from '../utils/nanoid.js';

// Defined outside component to prevent nodeTypes object from being re-created on every render
const NODE_TYPES = {
  editableNode: EditableNode,
  stickyNote: StickyNote,
  commentNode: CommentNode,
};

function toFlowNode(n: MindMapNode): Node {
  const shape = n.shape ?? 'rectangle';

  // Map special shapes to dedicated React Flow node types
  const nodeType =
    shape === 'sticky' ? 'stickyNote' : shape === 'comment' ? 'commentNode' : 'editableNode';

  // Restore explicit user-set dimensions; provide sensible defaults for each shape
  const width =
    n.width ??
    (shape === 'circle'
      ? 80
      : shape === 'ellipse'
        ? 100
        : shape === 'diamond'
          ? 120
          : shape === 'sticky'
            ? 160
            : shape === 'comment'
              ? 160
              : undefined);
  const height =
    n.height ??
    (shape === 'circle'
      ? 80
      : shape === 'ellipse'
        ? 60
        : shape === 'diamond'
          ? 90
          : shape === 'sticky'
            ? 120
            : shape === 'comment'
              ? 60
              : undefined);

  return {
    id: n.id,
    type: nodeType,
    position: n.position,
    data: {
      label: n.label,
      richLabel: n.richLabel,
      shape,
      fontSize: n.fontSize,
      textAlign: n.textAlign,
      color: n.color,
      textColor: n.textColor,
      fontFamily: n.fontFamily,
      fontWeight: n.fontWeight,
      fontStyle: n.fontStyle,
    },
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };
}

function markerToRf(marker: EdgeMarker | undefined): EdgeMarkerType | undefined {
  if (!marker || marker === 'none') return undefined;
  return { type: marker === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed };
}

function toFlowEdge(e: MindMapEdge): Edge {
  const markerEnd = markerToRf(e.markerEnd ?? 'arrowclosed');
  const markerStart = markerToRf(e.markerStart);
  const style: React.CSSProperties = {};
  if (e.strokeColor) style.stroke = e.strokeColor;
  if (e.strokeWidth != null) style.strokeWidth = e.strokeWidth;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: e.edgeStyle ?? 'default',
    ...(markerEnd ? { markerEnd } : {}),
    ...(markerStart ? { markerStart } : {}),
    ...(Object.keys(style).length > 0 ? { style } : {}),
  };
}

interface ContextMenuState {
  x: number;
  y: number;
  nodeId?: string;
  edgeId?: string;
  flowX: number;
  flowY: number;
}

interface ShapePickerState {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  sourceNodeId: string;
  sourceHandleId: string | null;
}

/** Returns the target-handle ID on `tgtNode` that faces toward `srcNode`. */
function facingTargetHandle(srcNode: Node, tgtNode: Node): string {
  const sw = (srcNode.measured?.width ?? srcNode.width ?? 80) as number;
  const sh = (srcNode.measured?.height ?? srcNode.height ?? 40) as number;
  const tw = (tgtNode.measured?.width ?? tgtNode.width ?? 80) as number;
  const th = (tgtNode.measured?.height ?? tgtNode.height ?? 40) as number;
  const dx = srcNode.position.x + sw / 2 - (tgtNode.position.x + tw / 2);
  const dy = srcNode.position.y + sh / 2 - (tgtNode.position.y + th / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx > 0 ? 'right-t' : 'left-t';
  }
  return dy > 0 ? 'bottom-t' : 'top-t';
}

// CanvasFlow is a child of ReactFlowProvider so it can use useReactFlow()
function CanvasFlow(): JSX.Element {
  const mindMap = useMindMapStore((s) => s.mindMap);
  const syncKey = useMindMapStore((s) => s.syncKey);
  const addNodeAction = useMindMapStore((s) => s.addNode);
  const addNodesAction = useMindMapStore((s) => s.addNodes);
  const deleteNodesAction = useMindMapStore((s) => s.deleteNodes);
  const deleteEdgesAction = useMindMapStore((s) => s.deleteEdges);
  const addEdgeAction = useMindMapStore((s) => s.addEdge);
  const reconnectEdgeAction = useMindMapStore((s) => s.reconnectEdge);
  const setNodePositions = useMindMapStore((s) => s.setNodePositions);
  const setNodeSizes = useMindMapStore((s) => s.setNodeSizes);
  const setEdgeStyle = useMindMapStore((s) => s.setEdgeStyle);
  const undo = useMindMapStore((s) => s.undo);
  const redo = useMindMapStore((s) => s.redo);
  const historyLength = useMindMapStore((s) => s.history.length);
  const futureLength = useMindMapStore((s) => s.future.length);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const editingNodeId = useUIStore((s) => s.editingNodeId);

  const { screenToFlowPosition, getNodes, fitView } = useReactFlow();
  // Read the current viewport zoom so we can counter-scale UI chrome
  // (connection handles, selection outlines, resize controls) and keep
  // them at a constant on-screen size regardless of zoom level.
  const zoom = useStore((s) => s.transform[2]);
  const zoomInv = zoom > 0 ? 1 / zoom : 1;

  const [nodes, setNodes] = useNodesState<Node>(mindMap?.nodes.map(toFlowNode) ?? []);
  const [edges, setEdges] = useEdgesState<Edge>(mindMap?.edges.map(toFlowEdge) ?? []);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [shapePicker, setShapePicker] = useState<ShapePickerState | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [showGrid, setShowGrid] = useState(true);
  const pendingSource = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // In-memory clipboard for copy/cut/paste of nodes (+ edges internal to the selection).
  const clipboardRef = useRef<{ nodes: MindMapNode[]; edges: MindMapEdge[] } | null>(null);
  // Track how many paste presses since the last copy/cut so we can stagger offsets.
  const pasteCountRef = useRef(0);

  // Re-sync local React Flow state whenever undo/redo/open/new fires (syncKey changes)
  useEffect(() => {
    setNodes(mindMap?.nodes.map(toFlowNode) ?? []);
    setEdges(mindMap?.edges.map(toFlowEdge) ?? []);
  }, [syncKey]); // intentionally omits setNodes/setEdges (stable refs)

  // --- Node / edge change handlers ---

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removes = changes.filter((c) => c.type === 'remove');
      const rest = changes.filter((c) => c.type !== 'remove');

      // Route removes through the store so they're undoable
      if (removes.length > 0) {
        const ids = removes.map((c) => c.id);
        deleteNodesAction(ids);
        setNodes((nds) => applyNodeChanges(removes, nds));
      }
      if (rest.length > 0) {
        setNodes((nds) => applyNodeChanges(rest, nds));
      }
    },
    [deleteNodesAction, setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removes = changes.filter((c) => c.type === 'remove');
      const rest = changes.filter((c) => c.type !== 'remove');

      if (removes.length > 0) {
        const ids = removes.map((c) => c.id);
        deleteEdgesAction(ids);
        setEdges((eds) => applyEdgeChanges(removes, eds));
      }
      if (rest.length > 0) {
        setEdges((eds) => applyEdgeChanges(rest, eds));
      }
    },
    [deleteEdgesAction, setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      pendingSource.current = null; // successful connection — no shape picker needed
      if (!connection.source || !connection.target) return;
      const allNodes = getNodes();
      const srcNode = allNodes.find((n) => n.id === connection.source);
      const tgtNode = allNodes.find((n) => n.id === connection.target);
      const targetHandle =
        srcNode && tgtNode
          ? facingTargetHandle(srcNode, tgtNode)
          : (connection.targetHandle ?? undefined);
      const edge: MindMapEdge = {
        id: nanoid(),
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle,
      };
      addEdgeAction(edge);
      setEdges((eds) => [...eds, toFlowEdge(edge)]);
    },
    [addEdgeAction, setEdges, getNodes],
  );

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      if (!newConnection.source || !newConnection.target) return;
      const newEdge: MindMapEdge = {
        id: oldEdge.id,
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle ?? undefined,
        targetHandle: newConnection.targetHandle ?? undefined,
      };
      reconnectEdgeAction(oldEdge.id, newEdge);
      setEdges((eds) => rfReconnectEdge(oldEdge, newConnection, eds));
    },
    [reconnectEdgeAction, setEdges],
  );

  const onConnectStart = useCallback(
    (_: unknown, params: { nodeId: string | null; handleId: string | null }) => {
      pendingSource.current = { nodeId: params.nodeId ?? '', handleId: params.handleId };
    },
    [],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { isValid: boolean | null }) => {
      // React Flow sets isValid=true when the drag ended on a valid target node/handle.
      // Use this as the authoritative check — DOM inspection is unreliable because the
      // connection overlay can intercept pointer events.
      if (connectionState?.isValid) return;

      const src = pendingSource.current;
      pendingSource.current = null;
      if (!src) return;

      const clientX = 'clientX' in event ? event.clientX : (event.changedTouches[0]?.clientX ?? 0);
      const clientY = 'clientY' in event ? event.clientY : (event.changedTouches[0]?.clientY ?? 0);

      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setShapePicker({
        x: clientX,
        y: clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
        sourceNodeId: src.nodeId,
        sourceHandleId: src.handleId,
      });
    },
    [screenToFlowPosition],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      // When a multi-selection is dragged, React Flow calls this once per
      // dragged node. Coalesce into a single history snapshot in
      // onSelectionDragStop and skip here.
      if (draggedNodes.length > 1) return;
      setNodePositions([{ id: node.id, position: node.position }]);
    },
    [setNodePositions],
  );

  const onSelectionDragStop = useCallback(
    (_: React.MouseEvent, draggedNodes: Node[]) => {
      if (draggedNodes.length === 0) return;
      setNodePositions(draggedNodes.map((n) => ({ id: n.id, position: n.position })));
    },
    [setNodePositions],
  );

  // --- Fit to view ---

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.1 });
  }, [fitView]);

  // --- Auto layout: radial tree from root ---

  const handleAutoLayout = useCallback(() => {
    const map = useMindMapStore.getState().mindMap;
    if (!map) return;
    const updates = computeRadialLayout(map.nodes, map.edges);
    setNodePositions(updates);
    const posMap = new Map(updates.map((u) => [u.id, u.position]));
    setNodes((nds) =>
      nds.map((n) => {
        const p = posMap.get(n.id);
        return p ? { ...n, position: p } : n;
      }),
    );
    // Let React flush the new positions before fitting the view
    setTimeout(() => fitView({ duration: 400, padding: 0.12 }), 50);
  }, [setNodePositions, setNodes, fitView]);

  // --- Export ---

  const handleExport = useCallback(
    async (type: ExportType) => {
      const map = useMindMapStore.getState().mindMap;
      if (!map) return;

      // Text / Markdown — pure data, no DOM capture needed
      if (type === 'text' || type === 'markdown') {
        const content = type === 'text' ? toPlainText(map) : toMarkdown(map);
        const ext = type === 'text' ? 'txt' : 'md';
        const result = await window.awapi.showSaveDialog({
          title: type === 'text' ? 'Export as Plain Text' : 'Export as Markdown',
          defaultPath: `${map.title || 'untitled'}.${ext}`,
          filters:
            type === 'text'
              ? [{ name: 'Text Files', extensions: ['txt'] }]
              : [{ name: 'Markdown', extensions: ['md'] }],
        });
        if (result.canceled || !result.filePath) return;
        await window.awapi.writeFile(result.filePath, content);
        return;
      }

      // PNG / SVG — capture via webContents.capturePage (handles SVG edges correctly)
      const rendererEl = wrapperRef.current?.querySelector(
        '.react-flow__renderer',
      ) as HTMLElement | null;
      if (!rendererEl) return;

      // Fit all nodes into view before capturing so the full graph is visible
      fitView({ duration: 0, padding: 0.1 });
      // Let the viewport transform settle before measuring / capturing
      await new Promise<void>((resolve) => setTimeout(resolve, 80));

      // Hide UI chrome that shouldn't appear in the export
      const background = rendererEl.querySelector(
        '.react-flow__background',
      ) as HTMLElement | null;
      const controls = wrapperRef.current?.querySelector(
        '.react-flow__controls',
      ) as HTMLElement | null;
      const minimap = wrapperRef.current?.querySelector(
        '.react-flow__minimap',
      ) as HTMLElement | null;
      const toolbar = wrapperRef.current?.querySelector(
        '.float-toolbar',
      ) as HTMLElement | null;
      if (background) background.style.visibility = 'hidden';
      if (controls) controls.style.visibility = 'hidden';
      if (minimap) minimap.style.visibility = 'hidden';
      if (toolbar) toolbar.style.visibility = 'hidden';

      // Capture BEFORE showing the save dialog so the window stays focused
      let pngBase64 = '';
      try {
        const rect = rendererEl.getBoundingClientRect();
        pngBase64 = await window.awapi.captureCanvas({
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      } catch (err) {
        console.error('Canvas capture failed:', err);
        await window.awapi.showMessageBox({
          type: 'error',
          title: 'Export Failed',
          message: 'Could not capture the canvas.',
          detail: String(err),
        });
        return;
      } finally {
        if (background) background.style.visibility = '';
        if (controls) controls.style.visibility = '';
        if (minimap) minimap.style.visibility = '';
        if (toolbar) toolbar.style.visibility = '';
      }

      const ext = type === 'png' ? 'png' : 'svg';
      const result = await window.awapi.showSaveDialog({
        title: type === 'png' ? 'Export as PNG' : 'Export as SVG',
        defaultPath: `${map.title || 'untitled'}.${ext}`,
        filters:
          type === 'png'
            ? [{ name: 'PNG Image', extensions: ['png'] }]
            : [{ name: 'SVG Image', extensions: ['svg'] }],
      });
      if (result.canceled || !result.filePath) return;

      if (type === 'png') {
        await window.awapi.writeBinaryFile(result.filePath, pngBase64);
      } else {
        // SVG: embed the captured PNG inside a properly sized SVG document
        const rect = rendererEl.getBoundingClientRect();
        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        const svgContent = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"`,
          `     width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
          `  <image href="data:image/png;base64,${pngBase64}"`,
          `         width="${w}" height="${h}" />`,
          `</svg>`,
        ].join('\n');
        await window.awapi.writeFile(result.filePath, svgContent);
      }
    },
    [fitView],
  );

  // Subscribe to menu export events
  useEffect(() => {
    const offPng = window.awapi.onMenuExportPng(() => void handleExport('png'));
    const offSvg = window.awapi.onMenuExportSvg(() => void handleExport('svg'));
    const offText = window.awapi.onMenuExportText(() => void handleExport('text'));
    const offMd = window.awapi.onMenuExportMarkdown(() => void handleExport('markdown'));
    return () => {
      offPng();
      offSvg();
      offText();
      offMd();
    };
  }, [handleExport]);

  // Global keyboard shortcuts: Fit to View (Ctrl+Shift+F) and Auto Layout (Ctrl+Shift+L)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const isMeta = e.metaKey || e.ctrlKey;
      if (!isMeta || !e.shiftKey) return;
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleFitView();
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        handleAutoLayout();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFitView, handleAutoLayout]);

  // --- Add node helper used by toolbar and context menu ---

  const addNewNode = useCallback(
    (
      flowPosition: { x: number; y: number },
      parentId?: string,
      shape: NodeShape = 'rectangle',
      parentHandleId?: string | null,
    ) => {
      const newNode: MindMapNode = {
        id: nanoid(),
        label: 'New Node',
        position: flowPosition,
        shape,
      };
      let targetHandle: string | undefined;
      if (parentId) {
        const parentNode = getNodes().find((n) => n.id === parentId);
        if (parentNode) {
          // Approximate the new node as a stand-in Node for direction computation
          const approxNewNode: Node = {
            ...toFlowNode(newNode),
            measured: { width: 80, height: 40 },
          };
          targetHandle = facingTargetHandle(parentNode, approxNewNode);
        }
      }
      const parentEdge: MindMapEdge | undefined = parentId
        ? {
            id: nanoid(),
            source: parentId,
            target: newNode.id,
            sourceHandle: parentHandleId ?? undefined,
            targetHandle,
          }
        : undefined;

      addNodeAction(newNode, parentEdge);
      setNodes((nds) => [...nds, toFlowNode(newNode)]);
      if (parentEdge) {
        setEdges((eds) => [...eds, toFlowEdge(parentEdge)]);
      }
    },
    [addNodeAction, setNodes, setEdges, getNodes],
  );

  const onShapeSelect = useCallback(
    (shape: NodeShape) => {
      if (!shapePicker) return;
      addNewNode(
        { x: shapePicker.flowX, y: shapePicker.flowY },
        shapePicker.sourceNodeId,
        shape,
        shapePicker.sourceHandleId,
      );
    },
    [shapePicker, addNewNode],
  );

  // Pane click: place sticky / comment when the matching tool is active
  const onPaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === 'select') return;

      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const shape: NodeShape = activeTool === 'sticky' ? 'sticky' : 'comment';
      const newNode: MindMapNode = {
        id: nanoid(),
        label: shape === 'sticky' ? 'Note…' : 'Comment…',
        position: flowPos,
        shape,
      };
      addNodeAction(newNode);
      setNodes((nds) => [...nds, toFlowNode(newNode)]);
      setActiveTool('select');
    },
    [activeTool, screenToFlowPosition, addNodeAction, setNodes],
  );

  // --- Keyboard handler: Delete/Backspace for selection; Cmd+Z / Cmd+Shift+Z for undo/redo ---

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const isMeta = e.metaKey || e.ctrlKey;

      // Copy / Cut / Paste --------------------------------------------------
      if (isMeta && (e.key === 'c' || e.key === 'C' || e.key === 'x' || e.key === 'X')) {
        const selected = nodes.filter((n) => n.selected);
        if (selected.length === 0) return;
        e.preventDefault();
        const selectedIds = new Set(selected.map((n) => n.id));
        const map = useMindMapStore.getState().mindMap;
        if (!map) return;
        const copiedNodes = map.nodes.filter((n) => selectedIds.has(n.id));
        const copiedEdges = map.edges.filter(
          (ed) => selectedIds.has(ed.source) && selectedIds.has(ed.target),
        );
        clipboardRef.current = {
          nodes: copiedNodes.map((n) => ({ ...n, position: { ...n.position } })),
          edges: copiedEdges.map((ed) => ({ ...ed })),
        };
        pasteCountRef.current = 0;
        if (e.key === 'x' || e.key === 'X') {
          const ids = [...selectedIds];
          deleteNodesAction(ids);
          setNodes((nds) => nds.filter((n) => !selectedIds.has(n.id)));
          setEdges((eds) =>
            eds.filter((ed) => !selectedIds.has(ed.source) && !selectedIds.has(ed.target)),
          );
        }
        return;
      }

      if (isMeta && (e.key === 'v' || e.key === 'V')) {
        const clip = clipboardRef.current;
        if (!clip || clip.nodes.length === 0) return;
        e.preventDefault();
        pasteCountRef.current += 1;
        const OFFSET = 24;
        const dx = OFFSET * pasteCountRef.current;
        const dy = OFFSET * pasteCountRef.current;
        const idMap = new Map<string, string>();
        const newNodes: MindMapNode[] = clip.nodes.map((n) => {
          const newId = nanoid();
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            position: { x: n.position.x + dx, y: n.position.y + dy },
          };
        });
        const newEdges: MindMapEdge[] = clip.edges.map((ed) => ({
          ...ed,
          id: nanoid(),
          source: idMap.get(ed.source) ?? ed.source,
          target: idMap.get(ed.target) ?? ed.target,
        }));
        addNodesAction(newNodes, newEdges);
        setNodes((nds) => [
          ...nds.map((n) => (n.selected ? { ...n, selected: false } : n)),
          ...newNodes.map((n) => ({ ...toFlowNode(n), selected: true })),
        ]);
        setEdges((eds) => [...eds, ...newEdges.map(toFlowEdge)]);
        return;
      }

      // Tool shortcuts (skip when any meta is held)
      if (!isMeta) {
        if (e.key === 'v' || e.key === 'V') {
          setActiveTool('select');
          return;
        }
        if (e.key === 's' || e.key === 'S') {
          setActiveTool('sticky');
          return;
        }
        if (e.key === 'c' || e.key === 'C') {
          setActiveTool('comment');
          return;
        }
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedNodeIds = nodes.filter((n) => n.selected).map((n) => n.id);
        const selectedEdgeIds = edges.filter((ed) => ed.selected).map((ed) => ed.id);

        if (selectedNodeIds.length > 0) {
          const idSet = new Set(selectedNodeIds);
          deleteNodesAction(selectedNodeIds);
          setNodes((nds) => nds.filter((n) => !idSet.has(n.id)));
          // Also remove any edges connected to the deleted nodes
          setEdges((eds) => eds.filter((ed) => !idSet.has(ed.source) && !idSet.has(ed.target)));
        }
        if (selectedEdgeIds.length > 0) {
          const edgeIdSet = new Set(selectedEdgeIds);
          deleteEdgesAction(selectedEdgeIds);
          setEdges((eds) => eds.filter((ed) => !edgeIdSet.has(ed.id)));
        }
      }
    },
    [nodes, edges, deleteNodesAction, deleteEdgesAction, addNodesAction, setNodes, setEdges],
  );

  // --- Context menu ---

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      const clientX = 'clientX' in e ? e.clientX : 0;
      const clientY = 'clientY' in e ? e.clientY : 0;
      const flowPos = screenToFlowPosition({ x: clientX, y: clientY });
      setContextMenu({ x: clientX, y: clientY, flowX: flowPos.x, flowY: flowPos.y });
    },
    [screenToFlowPosition],
  );

  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: node.id,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  // Right-click on the multi-selection overlay (when 2+ nodes are box-selected).
  // React Flow routes this through onSelectionContextMenu instead of onNodeContextMenu.
  const onSelectionContextMenu = useCallback(
    (e: React.MouseEvent, selectedNodes: Node[]) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Hit-test the cursor against the actual node DOM so we can use the
      // node under the pointer as the "reference" for ops like Same Size.
      // The selection overlay sits on top of nodes, so elementFromPoint
      // returns it — use elementsFromPoint and look beneath.
      const selectedIds = new Set(selectedNodes.map((n) => n.id));
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      let hoveredId: string | undefined;
      for (const el of stack) {
        const nodeEl = (el as HTMLElement).closest?.('.react-flow__node') as HTMLElement | null;
        const id = nodeEl?.dataset.id;
        if (id && selectedIds.has(id)) {
          hoveredId = id;
          break;
        }
      }

      const anchorId = hoveredId ?? selectedNodes[0]?.id;
      if (!anchorId) return;
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: anchorId,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        edgeId: edge.id,
        flowX: flowPos.x,
        flowY: flowPos.y,
      });
    },
    [screenToFlowPosition],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const contextMenuActions = useMemo((): ContextMenuAction[] => {
    if (!contextMenu) return [];

    if (contextMenu.nodeId) {
      const nodeId = contextMenu.nodeId;
      const selectedNodes = nodes.filter((n) => n.selected);
      const selectedIds = selectedNodes.map((n) => n.id);

      // Multi-node menu: right-clicked on a node that's part of a
      // multi-selection. Offer alignment / sizing / bulk delete.
      if (selectedIds.includes(nodeId) && selectedIds.length > 1) {
        const dim = (n: Node) => ({
          w: (n.width ?? n.measured?.width ?? 80) as number,
          h: (n.height ?? n.measured?.height ?? 40) as number,
        });

        const alignTo = (edge: 'left' | 'right' | 'top' | 'bottom') => {
          const bounds = selectedNodes.map((n) => {
            const { w, h } = dim(n);
            return { id: n.id, x: n.position.x, y: n.position.y, w, h };
          });
          let updates: Array<{ id: string; position: { x: number; y: number } }>;
          if (edge === 'left') {
            const minX = Math.min(...bounds.map((b) => b.x));
            updates = bounds.map((b) => ({ id: b.id, position: { x: minX, y: b.y } }));
          } else if (edge === 'right') {
            const maxR = Math.max(...bounds.map((b) => b.x + b.w));
            updates = bounds.map((b) => ({ id: b.id, position: { x: maxR - b.w, y: b.y } }));
          } else if (edge === 'top') {
            const minY = Math.min(...bounds.map((b) => b.y));
            updates = bounds.map((b) => ({ id: b.id, position: { x: b.x, y: minY } }));
          } else {
            const maxB = Math.max(...bounds.map((b) => b.y + b.h));
            updates = bounds.map((b) => ({ id: b.id, position: { x: b.x, y: maxB - b.h } }));
          }
          setNodePositions(updates);
          const posMap = new Map(updates.map((u) => [u.id, u.position]));
          setNodes((nds) =>
            nds.map((n) => {
              const p = posMap.get(n.id);
              return p ? { ...n, position: p } : n;
            }),
          );
        };

        const sameSize = () => {
          // If the right-click landed on one of the selected nodes, use its
          // dimensions as the reference. Otherwise fall back to the largest
          // node in the selection.
          const refNode = selectedNodes.find((n) => n.id === nodeId);
          let w: number;
          let h: number;
          if (refNode) {
            ({ w, h } = dim(refNode));
          } else {
            const dims = selectedNodes.map(dim);
            w = Math.max(...dims.map((d) => d.w));
            h = Math.max(...dims.map((d) => d.h));
          }
          const updates = selectedNodes.map((n) => ({ id: n.id, width: w, height: h }));
          setNodeSizes(updates);
          const idSet = new Set(selectedIds);
          setNodes((nds) => nds.map((n) => (idSet.has(n.id) ? { ...n, width: w, height: h } : n)));
        };

        const deleteSelected = () => {
          const idSet = new Set(selectedIds);
          deleteNodesAction(selectedIds);
          setNodes((nds) => nds.filter((n) => !idSet.has(n.id)));
          setEdges((eds) => eds.filter((e) => !idSet.has(e.source) && !idSet.has(e.target)));
        };

        return [
          { label: 'Align Left', onClick: () => alignTo('left') },
          { label: 'Align Right', onClick: () => alignTo('right') },
          { label: 'Align Top', onClick: () => alignTo('top') },
          { label: 'Align Bottom', onClick: () => alignTo('bottom') },
          { label: 'Same Size', dividerBefore: true, onClick: sameSize },
          {
            label: `Delete ${selectedIds.length} Nodes`,
            dividerBefore: true,
            onClick: deleteSelected,
          },
        ];
      }

      const nodePos = nodes.find((n) => n.id === nodeId)?.position ?? { x: 0, y: 0 };
      return [
        {
          label: 'Add Child Node',
          onClick: () => addNewNode({ x: nodePos.x + 200, y: nodePos.y + 100 }, nodeId),
        },
        {
          label: 'Add Sibling Node',
          onClick: () => {
            const parentEdge = edges.find((e) => e.target === nodeId);
            addNewNode({ x: nodePos.x, y: nodePos.y + 120 }, parentEdge?.source);
          },
        },
        {
          label: 'Delete Node',
          onClick: () => {
            deleteNodesAction([nodeId]);
            setNodes((nds) => nds.filter((n) => n.id !== nodeId));
            setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
          },
        },
      ];
    }

    if (contextMenu.edgeId) {
      const edgeId = contextMenu.edgeId;
      return [
        {
          label: 'Delete Edge',
          onClick: () => {
            deleteEdgesAction([edgeId]);
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
          },
        },
        {
          label: 'Style: Curved (default)',
          dividerBefore: true,
          onClick: () => {
            setEdgeStyle(edgeId, 'default');
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, type: 'default' } : e)));
          },
        },
        {
          label: 'Style: Straight',
          onClick: () => {
            setEdgeStyle(edgeId, 'straight');
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, type: 'straight' } : e)));
          },
        },
        {
          label: 'Style: Step',
          onClick: () => {
            setEdgeStyle(edgeId, 'step');
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, type: 'step' } : e)));
          },
        },
        {
          label: 'Style: Smooth Step',
          onClick: () => {
            setEdgeStyle(edgeId, 'smoothstep');
            setEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...e, type: 'smoothstep' } : e)));
          },
        },
      ];
    }

    // Pane context menu
    return [
      {
        label: 'Add Node Here',
        onClick: () => addNewNode({ x: contextMenu.flowX, y: contextMenu.flowY }),
      },
    ];
  }, [
    contextMenu,
    nodes,
    edges,
    addNewNode,
    deleteNodesAction,
    deleteEdgesAction,
    setEdgeStyle,
    setNodePositions,
    setNodeSizes,
    setNodes,
    setEdges,
  ]);

  // Aggregate the currently selected editable nodes so a single shared
  // formatting toolbar can apply changes to all of them at once.
  const formattingSelection = useMemo(() => {
    const selected = nodes.filter((n) => n.selected && n.type === 'editableNode');
    if (selected.length === 0) {
      return {
        nodeIds: [] as string[],
        shape: undefined as NodeShape | undefined,
        fontSize: undefined as number | undefined,
        textAlign: undefined as 'left' | 'center' | 'right' | undefined,
        allTextShape: false,
      };
    }
    const shapes = new Set(
      selected.map((n) => (n.data.shape as NodeShape | undefined) ?? 'rectangle'),
    );
    const fontSizes = new Set(selected.map((n) => n.data.fontSize as number | undefined));
    const aligns = new Set(
      selected.map(
        (n) => (n.data.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'center',
      ),
    );
    return {
      nodeIds: selected.map((n) => n.id),
      shape: shapes.size === 1 ? ([...shapes][0] as NodeShape) : undefined,
      fontSize: fontSizes.size === 1 ? ([...fontSizes][0] as number | undefined) : undefined,
      textAlign: aligns.size === 1 ? ([...aligns][0] as 'left' | 'center' | 'right') : undefined,
      allTextShape: shapes.size === 1 && shapes.has('text'),
    };
  }, [nodes]);

  // Hide the toolbar while a single node is being edited; the TextEditingToolbar
  // inside EditableNode handles text-specific formatting during editing.
  const showFormattingToolbar =
    formattingSelection.nodeIds.length > 0 &&
    !(formattingSelection.nodeIds.length === 1 && editingNodeId === formattingSelection.nodeIds[0]);

  // Aggregate currently selected edges for the edge formatting toolbar.
  const edgeFormattingSelection = useMemo(() => {
    const selected = edges.filter((e) => e.selected);
    if (selected.length === 0) {
      return {
        edgeIds: [] as string[],
        style: undefined as 'default' | 'straight' | 'step' | 'smoothstep' | undefined,
        color: undefined as string | undefined,
        width: undefined as number | undefined,
        markerStart: undefined as EdgeMarker | undefined,
        markerEnd: undefined as EdgeMarker | undefined,
      };
    }
    // Read the persisted model to access fields React Flow strips into its own shape.
    const map = useMindMapStore.getState().mindMap;
    const selectedIds = new Set(selected.map((e) => e.id));
    const persisted = map?.edges.filter((e) => selectedIds.has(e.id)) ?? [];
    const styles = new Set(persisted.map((e) => e.edgeStyle ?? 'default'));
    const colors = new Set(persisted.map((e) => e.strokeColor));
    const widths = new Set(persisted.map((e) => e.strokeWidth));
    const ms = new Set(persisted.map((e) => e.markerStart ?? 'none'));
    const me = new Set(persisted.map((e) => e.markerEnd ?? 'arrowclosed'));
    return {
      edgeIds: persisted.map((e) => e.id),
      style:
        styles.size === 1
          ? ([...styles][0] as 'default' | 'straight' | 'step' | 'smoothstep')
          : undefined,
      color: colors.size === 1 ? ([...colors][0] as string | undefined) : undefined,
      width: widths.size === 1 ? ([...widths][0] as number | undefined) : undefined,
      markerStart: ms.size === 1 ? ([...ms][0] as EdgeMarker) : undefined,
      markerEnd: me.size === 1 ? ([...me][0] as EdgeMarker) : undefined,
    };
  }, [edges]);

  return (
    <div className="canvas-wrapper" ref={wrapperRef} onKeyDown={onKeyDown} tabIndex={0}>
      <div className="canvas-toolbar" data-tool={activeTool}>
        <button
          className="toolbar-btn"
          title="Undo (⌘Z)"
          disabled={historyLength === 0}
          onClick={undo}
        >
          ↩ Undo
        </button>
        <button
          className="toolbar-btn"
          title="Redo (⌘⇧Z)"
          disabled={futureLength === 0}
          onClick={redo}
        >
          ↪ Redo
        </button>
        <div className="toolbar-spacer" />
        <button className="toolbar-btn" title="Toggle light / dark theme" onClick={toggleTheme}>
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
      </div>

      <div className="canvas-area">
        <div
          className={`canvas-flow tool-${activeTool}`}
          style={{ ['--zoom-inv' as string]: zoomInv } as React.CSSProperties}
          onMouseDown={(e) => {
            if (e.button === 2) e.currentTarget.classList.add('is-panning');
          }}
          onMouseUp={(e) => {
            if (e.button === 2) e.currentTarget.classList.remove('is-panning');
          }}
          onMouseLeave={(e) => e.currentTarget.classList.remove('is-panning')}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onReconnect={onReconnect}
            edgesReconnectable
            onNodeDragStop={onNodeDragStop}
            onSelectionDragStop={onSelectionDragStop}
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onSelectionContextMenu={onSelectionContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            panOnDrag={[2]}
            selectionOnDrag
            zoomOnScroll
            zoomOnPinch
            fitView
          >
            {showGrid && <Background />}
            <Controls />
            <MiniMap pannable zoomable />
            {showFormattingToolbar && (
              <NodeFormattingToolbar
                nodeIds={formattingSelection.nodeIds}
                currentShape={formattingSelection.shape}
                currentFontSize={formattingSelection.fontSize}
                currentTextAlign={formattingSelection.textAlign}
                allTextShape={formattingSelection.allTextShape}
              />
            )}
            {edgeFormattingSelection.edgeIds.length > 0 && (
              <EdgeFormattingToolbar
                edgeIds={edgeFormattingSelection.edgeIds}
                currentStyle={edgeFormattingSelection.style}
                currentColor={edgeFormattingSelection.color}
                currentWidth={edgeFormattingSelection.width}
                currentMarkerStart={edgeFormattingSelection.markerStart}
                currentMarkerEnd={edgeFormattingSelection.markerEnd}
              />
            )}
          </ReactFlow>
        </div>
        <CanvasToolbar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          onAutoLayout={handleAutoLayout}
          onFitView={handleFitView}
          onExport={handleExport}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid((g) => !g)}
          onAddNode={() => {
            const center = screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            });
            addNewNode(center);
          }}
        />
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={contextMenuActions}
          onClose={closeContextMenu}
        />
      )}
      {shapePicker && (
        <ShapePicker
          x={shapePicker.x}
          y={shapePicker.y}
          onSelect={onShapeSelect}
          onClose={() => setShapePicker(null)}
        />
      )}
    </div>
  );
}

export function Canvas(): JSX.Element {
  const mindMap = useMindMapStore((s) => s.mindMap);

  if (!mindMap) {
    return (
      <div className="canvas-empty">
        <p>No mind map open.</p>
        <p>
          Use <kbd>File › New Map</kbd> or <kbd>File › Open…</kbd> to get started.
        </p>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CanvasFlow />
    </ReactFlowProvider>
  );
}
