/** Visual shape of a node on the canvas. */
export type NodeShape =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'sticky'
  | 'comment';

/** Core data model for a mind map. */

export interface MindMapNode {
  id: string;
  label: string;
  /** Position on the canvas. */
  position: { x: number; y: number };
  /** Optional colour override (CSS colour string). */
  color?: string;
  /** Visual shape. Defaults to 'rectangle'. */
  shape?: NodeShape;
  /** Explicit pixel dimensions set by the user via resize handles. */
  width?: number;
  height?: number;
  /** Font size in pixels. Defaults to 14. */
  fontSize?: number;
  /** Horizontal text alignment. Currently only honoured for the 'text' shape. Defaults to 'center'. */
  textAlign?: 'left' | 'center' | 'right';
  /** Collapsed children are hidden on the canvas. */
  collapsed?: boolean;
}

export type EdgeStyle = 'default' | 'straight' | 'step' | 'smoothstep';

/** Arrow marker style at an edge endpoint. */
export type EdgeMarker = 'none' | 'arrow' | 'arrowclosed';

export interface MindMapEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  /** Visual style of the edge. Defaults to 'default' (bezier). */
  edgeStyle?: EdgeStyle;
  /** Stroke colour (CSS colour string). Defaults to the theme edge colour. */
  strokeColor?: string;
  /** Stroke width in pixels. Defaults to 1.5. */
  strokeWidth?: number;
  /** Arrow marker at the source end. Defaults to 'none'. */
  markerStart?: EdgeMarker;
  /** Arrow marker at the target end. Defaults to 'arrowclosed' for new edges. */
  markerEnd?: EdgeMarker;
}

export interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  /** ISO-8601 string. */
  updatedAt: string;
}

/** File format version embedded in every saved `.awmm` file. */
export const AWMM_VERSION = 1;

export interface AwmmFile {
  version: typeof AWMM_VERSION;
  mindMap: MindMap;
}
