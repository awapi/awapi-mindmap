import type { MindMapNode, MindMapEdge } from '../types/mindmap.js';

/**
 * Compute a radial (sunburst) tree layout for a mind-map graph.
 *
 * Algorithm:
 *  1. Find the root — the node with the lowest in-degree (no parents).
 *  2. Build a spanning tree via BFS (handles cycles / disconnected nodes safely).
 *  3. Count the leaf-node descendants of every subtree so that each child's
 *     angular slice is proportional to the size of its subtree.
 *  4. Recursively place children on concentric rings, spreading them evenly
 *     within their allocated angle slice.
 *  5. Any nodes unreachable from the root (disconnected components) are
 *     placed below the main tree.
 *
 * Returns a position-update array ready to be passed to `setNodePositions`.
 */
export function computeRadialLayout(
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): Array<{ id: string; position: { x: number; y: number } }> {
  if (nodes.length === 0) return [];

  // ── Build directed adjacency list ────────────────────────────────────────
  const childrenOf = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const inDegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));

  for (const edge of edges) {
    if (!childrenOf.has(edge.source) || !childrenOf.has(edge.target)) continue;
    childrenOf.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // ── Root: node with in-degree 0, or the very first node ──────────────────
  const rootNode = nodes.find((n) => (inDegree.get(n.id) ?? 0) === 0) ?? nodes[0];
  if (!rootNode) return [];

  // ── Spanning tree via BFS (breaks cycles, handles repeated targets) ───────
  const treeChildrenOf = new Map<string, string[]>(nodes.map((n) => [n.id, []]));
  const treeVisited = new Set<string>([rootNode.id]);
  const bfsQueue: string[] = [rootNode.id];

  while (bfsQueue.length > 0) {
    const id = bfsQueue.shift()!;
    for (const childId of childrenOf.get(id) ?? []) {
      if (!treeVisited.has(childId)) {
        treeVisited.add(childId);
        treeChildrenOf.get(id)!.push(childId);
        bfsQueue.push(childId);
      }
    }
  }

  // ── Count leaf descendants for proportional angle distribution ────────────
  const leafCountOf = new Map<string, number>();
  function countLeaves(id: string): number {
    const kids = treeChildrenOf.get(id) ?? [];
    if (kids.length === 0) {
      leafCountOf.set(id, 1);
      return 1;
    }
    const total = kids.reduce((sum, cid) => sum + countLeaves(cid), 0);
    leafCountOf.set(id, total);
    return total;
  }
  countLeaves(rootNode.id);

  // ── Radial placement ──────────────────────────────────────────────────────
  /** Pixels between concentric rings. */
  const LEVEL_RADIUS = 220;

  const positions = new Map<string, { x: number; y: number }>();

  function place(
    id: string,
    cx: number,
    cy: number,
    radius: number,
    startAngle: number,
    endAngle: number,
  ): void {
    positions.set(id, { x: cx, y: cy });

    const kids = treeChildrenOf.get(id) ?? [];
    if (kids.length === 0) return;

    const totalLeaves = kids.reduce((s, cid) => s + (leafCountOf.get(cid) ?? 1), 0);
    let angle = startAngle;

    for (const childId of kids) {
      const fraction = (leafCountOf.get(childId) ?? 1) / totalLeaves;
      const span = fraction * (endAngle - startAngle);
      const midAngle = angle + span / 2;

      place(
        childId,
        cx + radius * Math.cos(midAngle),
        cy + radius * Math.sin(midAngle),
        LEVEL_RADIUS,
        angle,
        angle + span,
      );
      angle += span;
    }
  }

  // Start at -½π so the first child is placed at the top rather than the right.
  const START = -Math.PI / 2;
  place(rootNode.id, 0, 0, LEVEL_RADIUS, START, START + 2 * Math.PI);

  // ── Disconnected / orphan nodes ───────────────────────────────────────────
  // Place them in a row below the main cluster.
  let orphanX = 0;
  for (const node of nodes) {
    if (!positions.has(node.id)) {
      positions.set(node.id, { x: orphanX, y: 600 });
      orphanX += 220;
    }
  }

  return nodes.map((n) => ({
    id: n.id,
    position: positions.get(n.id) ?? n.position,
  }));
}
