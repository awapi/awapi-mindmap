import { useEffect, useCallback, useState, useRef, useMemo } from 'react';
import type { JSX } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  ConnectionMode,
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
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMindMapStore, useThemeStore } from '../state/stores.js';
import { EditableNode } from './EditableNode.js';
import { StickyNote } from './StickyNote.js';
import { CommentNode } from './CommentNode.js';
import { ContextMenu } from './ContextMenu.js';
import { ShapePicker } from './ShapePicker.js';
import { CanvasToolbar } from './CanvasToolbar.js';
import type { ActiveTool } from './CanvasToolbar.js';
import type { ContextMenuAction } from './ContextMenu.js';
import type { MindMapNode, MindMapEdge, NodeShape } from '../types/mindmap.js';
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
    data: { label: n.label, shape, fontSize: n.fontSize, textAlign: n.textAlign, color: n.color },
    style: n.color && nodeType === 'editableNode' ? { background: n.color } : undefined,
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };
}

function toFlowEdge(e: MindMapEdge): Edge {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    type: e.edgeStyle ?? 'default',
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
  const dx = (srcNode.position.x + sw / 2) - (tgtNode.position.x + tw / 2);
  const dy = (srcNode.position.y + sh / 2) - (tgtNode.position.y + th / 2);
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
  const deleteNodesAction = useMindMapStore((s) => s.deleteNodes);
  const deleteEdgesAction = useMindMapStore((s) => s.deleteEdges);
  const addEdgeAction = useMindMapStore((s) => s.addEdge);
  const reconnectEdgeAction = useMindMapStore((s) => s.reconnectEdge);
  const syncPositions = useMindMapStore((s) => s.syncPositions);
  const setEdgeStyle = useMindMapStore((s) => s.setEdgeStyle);
  const undo = useMindMapStore((s) => s.undo);
  const redo = useMindMapStore((s) => s.redo);
  const historyLength = useMindMapStore((s) => s.history.length);
  const futureLength = useMindMapStore((s) => s.future.length);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  const { screenToFlowPosition, getNodes } = useReactFlow();
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
  const pendingSource = useRef<{ nodeId: string; handleId: string | null } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
        srcNode && tgtNode ? facingTargetHandle(srcNode, tgtNode) : (connection.targetHandle ?? undefined);
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
    (_: React.MouseEvent, node: Node) => {
      syncPositions([{ id: node.id, position: node.position }]);
    },
    [syncPositions],
  );

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

      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (isMeta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }

      // Tool shortcuts (skip when any meta is held)
      if (!isMeta) {
        if (e.key === 'v' || e.key === 'V') { setActiveTool('select'); return; }
        if (e.key === 's' || e.key === 'S') { setActiveTool('sticky'); return; }
        if (e.key === 'c' || e.key === 'C') { setActiveTool('comment'); return; }
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
    [nodes, edges, deleteNodesAction, deleteEdgesAction, setNodes, setEdges, undo, redo],
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
    setNodes,
    setEdges,
  ]);

  return (
    <div className="canvas-wrapper" ref={wrapperRef} onKeyDown={onKeyDown} tabIndex={0}>
      <div className="canvas-toolbar" data-tool={activeTool}>
        <button
          className="toolbar-btn"
          title="Add Node"
          onClick={() => {
            const center = screenToFlowPosition({
              x: window.innerWidth / 2,
              y: window.innerHeight / 2,
            });
            addNewNode(center);
          }}
        >
          + Add Node
        </button>
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
          onMouseDown={(e) => { if (e.button === 2) e.currentTarget.classList.add('is-panning'); }}
          onMouseUp={(e) => { if (e.button === 2) e.currentTarget.classList.remove('is-panning'); }}
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
            onPaneClick={onPaneClick}
            onPaneContextMenu={onPaneContextMenu}
            onNodeContextMenu={onNodeContextMenu}
            onEdgeContextMenu={onEdgeContextMenu}
            connectionMode={ConnectionMode.Loose}
            deleteKeyCode={null}
            panOnDrag={[2]}
            selectionOnDrag
            fitView
          >
            <Background />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </div>
        <CanvasToolbar activeTool={activeTool} onToolChange={setActiveTool} />
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
