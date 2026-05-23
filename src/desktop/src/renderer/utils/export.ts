import type { MindMap, MindMapNode } from '../types/mindmap.js';

/** Build a child-list map from the edge list. */
function buildChildren(map: MindMap): Map<string, string[]> {
  const children = new Map<string, string[]>(map.nodes.map((n) => [n.id, []]));
  for (const edge of map.edges) {
    children.get(edge.source)?.push(edge.target);
  }
  return children;
}

/** Find root nodes (nodes with no incoming edges). */
function findRoots(map: MindMap): string[] {
  const hasParent = new Set(map.edges.map((e) => e.target));
  return map.nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
}

function nodeLabel(node: MindMapNode): string {
  return node.label.trim() || '(unnamed)';
}

/**
 * Export the mind map as an indented plain-text outline.
 * Each level of nesting is represented by two spaces per depth.
 */
export function toPlainText(map: MindMap): string {
  const nodeMap = new Map(map.nodes.map((n) => [n.id, n]));
  const children = buildChildren(map);
  const roots = findRoots(map);
  const lines: string[] = [`${map.title}`, ''];

  const visited = new Set<string>();

  function walk(id: string, depth: number): void {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    lines.push('  '.repeat(depth) + nodeLabel(node));
    for (const childId of children.get(id) ?? []) {
      walk(childId, depth + 1);
    }
  }

  for (const rootId of roots) {
    walk(rootId, 0);
  }

  return lines.join('\n');
}

/**
 * Export the mind map as a Markdown nested list.
 * The map title becomes an H1 heading; nodes form a nested `- item` list.
 */
export function toMarkdown(map: MindMap): string {
  const nodeMap = new Map(map.nodes.map((n) => [n.id, n]));
  const children = buildChildren(map);
  const roots = findRoots(map);
  const lines: string[] = [`# ${map.title}`, ''];

  const visited = new Set<string>();

  function walk(id: string, depth: number): void {
    if (visited.has(id)) return;
    visited.add(id);
    const node = nodeMap.get(id);
    if (!node) return;
    lines.push(`${'  '.repeat(depth)}- ${nodeLabel(node)}`);
    for (const childId of children.get(id) ?? []) {
      walk(childId, depth + 1);
    }
  }

  for (const rootId of roots) {
    walk(rootId, 0);
  }

  return lines.join('\n');
}
