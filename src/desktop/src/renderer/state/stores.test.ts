import { beforeEach, describe, expect, it } from 'vitest';
import { useMindMapStore } from './stores.js';
import type { MindMapEdge, MindMapNode } from '../types/mindmap.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, label = 'Node'): MindMapNode {
  return { id, label, position: { x: 0, y: 0 } };
}

function makeEdge(id: string, source: string, target: string): MindMapEdge {
  return { id, source, target };
}

/** Reset the store to a fresh blank state before every test. */
beforeEach(() => {
  useMindMapStore.getState().newMap();
});

// ---------------------------------------------------------------------------
// newMap
// ---------------------------------------------------------------------------

describe('newMap', () => {
  it('creates a mind map with a single root node', () => {
    const { mindMap } = useMindMapStore.getState();
    expect(mindMap).not.toBeNull();
    expect(mindMap!.nodes).toHaveLength(1);
    expect(mindMap!.nodes[0].label).toBe('Central Topic');
  });

  it('resets history, future and dirty flag', () => {
    const s = useMindMapStore.getState();
    expect(s.history).toHaveLength(0);
    expect(s.future).toHaveLength(0);
    expect(s.isDirty).toBe(false);
  });

  it('increments syncKey on each call', () => {
    const key1 = useMindMapStore.getState().syncKey;
    useMindMapStore.getState().newMap();
    expect(useMindMapStore.getState().syncKey).toBe(key1 + 1);
  });
});

// ---------------------------------------------------------------------------
// addNode
// ---------------------------------------------------------------------------

describe('addNode', () => {
  it('appends a node to the mind map', () => {
    const node = makeNode('n1');
    useMindMapStore.getState().addNode(node);
    const { mindMap } = useMindMapStore.getState();
    expect(mindMap!.nodes.some((n) => n.id === 'n1')).toBe(true);
  });

  it('also adds a parent edge when provided', () => {
    const node = makeNode('n1');
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    const edge = makeEdge('e1', rootId, 'n1');
    useMindMapStore.getState().addNode(node, edge);
    const { mindMap } = useMindMapStore.getState();
    expect(mindMap!.edges.some((e) => e.id === 'e1')).toBe(true);
  });

  it('pushes to undo history and marks dirty', () => {
    useMindMapStore.getState().addNode(makeNode('n1'));
    const { history, isDirty } = useMindMapStore.getState();
    expect(history).toHaveLength(1);
    expect(isDirty).toBe(true);
  });

  it('does nothing when no map is open', () => {
    useMindMapStore.setState({ mindMap: null });
    useMindMapStore.getState().addNode(makeNode('n1'));
    expect(useMindMapStore.getState().mindMap).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteNodes
// ---------------------------------------------------------------------------

describe('deleteNodes', () => {
  it('removes the node and its connected edges', () => {
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    const node = makeNode('n1');
    const edge = makeEdge('e1', rootId, 'n1');
    useMindMapStore.getState().addNode(node, edge);

    useMindMapStore.getState().deleteNodes(['n1']);
    const { mindMap } = useMindMapStore.getState();
    expect(mindMap!.nodes.find((n) => n.id === 'n1')).toBeUndefined();
    expect(mindMap!.edges.find((e) => e.id === 'e1')).toBeUndefined();
  });

  it('pushes to history', () => {
    const { history: before } = useMindMapStore.getState();
    useMindMapStore.getState().deleteNodes([useMindMapStore.getState().mindMap!.nodes[0].id]);
    expect(useMindMapStore.getState().history.length).toBeGreaterThan(before.length);
  });
});

// ---------------------------------------------------------------------------
// deleteEdges
// ---------------------------------------------------------------------------

describe('deleteEdges', () => {
  it('removes edges by id, leaving nodes intact', () => {
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    const node = makeNode('n2');
    const edge = makeEdge('e2', rootId, 'n2');
    useMindMapStore.getState().addNode(node, edge);

    useMindMapStore.getState().deleteEdges(['e2']);
    const { mindMap } = useMindMapStore.getState();
    expect(mindMap!.edges.find((e) => e.id === 'e2')).toBeUndefined();
    expect(mindMap!.nodes.find((n) => n.id === 'n2')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// renameNode
// ---------------------------------------------------------------------------

describe('renameNode', () => {
  it('updates the label', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().renameNode(id, 'Renamed');
    const node = useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!;
    expect(node.label).toBe('Renamed');
  });

  it('marks dirty and pushes history', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().renameNode(id, 'X');
    expect(useMindMapStore.getState().isDirty).toBe(true);
    expect(useMindMapStore.getState().history.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// addEdge
// ---------------------------------------------------------------------------

describe('addEdge', () => {
  it('adds an edge', () => {
    useMindMapStore.getState().addNode(makeNode('a'));
    useMindMapStore.getState().addNode(makeNode('b'));
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().addEdge(makeEdge('eAB', rootId, 'a'));
    expect(useMindMapStore.getState().mindMap!.edges.find((e) => e.id === 'eAB')).toBeDefined();
  });

  it('ignores duplicate source→target edges', () => {
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().addNode(makeNode('dup'));
    useMindMapStore.getState().addEdge(makeEdge('e-dup-1', rootId, 'dup'));
    useMindMapStore.getState().addEdge(makeEdge('e-dup-2', rootId, 'dup'));
    const edges = useMindMapStore.getState().mindMap!.edges.filter(
      (e) => e.source === rootId && e.target === 'dup',
    );
    expect(edges).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// undo / redo
// ---------------------------------------------------------------------------

describe('undo / redo', () => {
  it('undo restores the previous state', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().renameNode(id, 'Changed');
    useMindMapStore.getState().undo();
    const node = useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!;
    expect(node.label).toBe('Central Topic');
  });

  it('redo re-applies the undone action', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().renameNode(id, 'Changed');
    useMindMapStore.getState().undo();
    useMindMapStore.getState().redo();
    const node = useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!;
    expect(node.label).toBe('Changed');
  });

  it('undo increments syncKey', () => {
    useMindMapStore.getState().addNode(makeNode('x'));
    const key = useMindMapStore.getState().syncKey;
    useMindMapStore.getState().undo();
    expect(useMindMapStore.getState().syncKey).toBe(key + 1);
  });

  it('redo increments syncKey', () => {
    useMindMapStore.getState().addNode(makeNode('y'));
    useMindMapStore.getState().undo();
    const key = useMindMapStore.getState().syncKey;
    useMindMapStore.getState().redo();
    expect(useMindMapStore.getState().syncKey).toBe(key + 1);
  });

  it('undo does nothing when history is empty', () => {
    const state = useMindMapStore.getState();
    const label = state.mindMap!.nodes[0].label;
    state.undo();
    expect(useMindMapStore.getState().mindMap!.nodes[0].label).toBe(label);
  });

  it('redo does nothing when future is empty', () => {
    const state = useMindMapStore.getState();
    const syncKey = state.syncKey;
    state.redo();
    expect(useMindMapStore.getState().syncKey).toBe(syncKey);
  });

  it('new action clears the redo stack', () => {
    useMindMapStore.getState().addNode(makeNode('z'));
    useMindMapStore.getState().undo();
    expect(useMindMapStore.getState().future.length).toBeGreaterThan(0);
    useMindMapStore.getState().addNode(makeNode('z2'));
    expect(useMindMapStore.getState().future).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// setNodeShape / setNodeColor / setEdgeStyle
// ---------------------------------------------------------------------------

describe('setNodeShape', () => {
  it('updates the shape of a node', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().setNodeShape(id, 'circle');
    const node = useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!;
    expect(node.shape).toBe('circle');
  });
});

describe('setNodeColor', () => {
  it('sets and clears node color', () => {
    const id = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().setNodeColor(id, '#ff0000');
    expect(
      useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!.color,
    ).toBe('#ff0000');
    useMindMapStore.getState().setNodeColor(id, undefined);
    expect(
      useMindMapStore.getState().mindMap!.nodes.find((n) => n.id === id)!.color,
    ).toBeUndefined();
  });
});

describe('setEdgeStyle', () => {
  it('updates the edge style', () => {
    const rootId = useMindMapStore.getState().mindMap!.nodes[0].id;
    useMindMapStore.getState().addNode(makeNode('es1'));
    useMindMapStore.getState().addEdge(makeEdge('edge-style', rootId, 'es1'));
    useMindMapStore.getState().setEdgeStyle('edge-style', 'smoothstep');
    const edge = useMindMapStore.getState().mindMap!.edges.find((e) => e.id === 'edge-style')!;
    expect(edge.edgeStyle).toBe('smoothstep');
  });
});

// ---------------------------------------------------------------------------
// updateTitle
// ---------------------------------------------------------------------------

describe('updateTitle', () => {
  it('updates the map title and marks dirty', () => {
    useMindMapStore.getState().updateTitle('My Map');
    const { mindMap, isDirty } = useMindMapStore.getState();
    expect(mindMap!.title).toBe('My Map');
    expect(isDirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// markSaved / setMindMap
// ---------------------------------------------------------------------------

describe('markSaved', () => {
  it('clears dirty and stores filePath', () => {
    useMindMapStore.getState().updateTitle('X'); // make dirty
    useMindMapStore.getState().markSaved('/tmp/test.awmm');
    const { isDirty, filePath } = useMindMapStore.getState();
    expect(isDirty).toBe(false);
    expect(filePath).toBe('/tmp/test.awmm');
  });
});
