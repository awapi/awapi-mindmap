import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';
import type { NodeShape } from '../types/mindmap.js';
import { useDraggableToolbar } from '../hooks/useDraggableToolbar.js';
import { ColorPicker } from './ColorPicker.js';

interface NodeFormattingToolbarProps {
  /** IDs of all selected nodes the toolbar should apply changes to. */
  nodeIds: string[];
  /** Shared shape across all selected nodes, or `undefined` if mixed. */
  currentShape: NodeShape | undefined;
  /** Shared fill colour across all selected nodes, or `undefined` if mixed. */
  currentColor?: string;
  /** Shared border colour across all selected nodes, or `undefined` if mixed. */
  currentBorderColor?: string;
  /** Shared font size across all selected nodes, or `undefined` if mixed. */
  currentFontSize?: number;
  /** Shared text alignment across all selected nodes, or `undefined` if mixed. */
  currentTextAlign?: 'left' | 'center' | 'right';
  /** True when every selected node uses the `'text'` shape (controls visibility of the alignment group). */
  allTextShape: boolean;
}

const SHAPE_OPTIONS: Array<{ shape: NodeShape; label: string; glyph: string }> = [
  { shape: 'rectangle', label: 'Rectangle', glyph: '▭' },
  { shape: 'circle', label: 'Circle', glyph: '○' },
  { shape: 'ellipse', label: 'Ellipse', glyph: '⬭' },
  { shape: 'diamond', label: 'Diamond', glyph: '◇' },
  { shape: 'sticky', label: 'Sticky note', glyph: '◰' },
  { shape: 'text', label: 'Text only', glyph: 'T' },
];

const FONT_MIN = 6;
const FONT_MAX = 96;
const FONT_DEFAULT = 10;
const FONT_STEP = 2;
const NO_FILL_COLOR = 'transparent';

const clampFont = (n: number) => Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));

function nodeTypeForShape(shape: NodeShape): 'editableNode' | 'stickyNote' | 'commentNode' {
  return shape === 'sticky' ? 'stickyNote' : shape === 'comment' ? 'commentNode' : 'editableNode';
}

function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }): JSX.Element {
  const bars = [
    { y: 3, w: 12 },
    { y: 6, w: 8 },
    { y: 9, w: 12 },
    { y: 12, w: 8 },
  ];
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
      {bars.map((b, i) => {
        const x = align === 'left' ? 1 : align === 'right' ? 13 - b.w : (14 - b.w) / 2;
        return <rect key={i} x={x} y={b.y} width={b.w} height={1.4} rx={0.5} fill="currentColor" />;
      })}
    </svg>
  );
}

export function NodeFormattingToolbar({
  nodeIds,
  currentShape,
  currentColor,
  currentBorderColor,
  currentFontSize,
  currentTextAlign,
  allTextShape,
}: NodeFormattingToolbarProps): JSX.Element | null {
  const setNodeShape = useMindMapStore((s) => s.setNodeShape);
  const setNodeColor = useMindMapStore((s) => s.setNodeColor);
  const setNodeBorderColor = useMindMapStore((s) => s.setNodeBorderColor);
  const setNodeFontSize = useMindMapStore((s) => s.setNodeFontSize);
  const setNodeTextAlign = useMindMapStore((s) => s.setNodeTextAlign);
  const { setNodes } = useReactFlow();
  const selectionKey = nodeIds.join(',');
  const { offset, dragHandleProps } = useDraggableToolbar(selectionKey);

  const idSet = new Set(nodeIds);

  const applyShape = (shape: NodeShape) => {
    setNodeShape(nodeIds, shape);
    const type = nodeTypeForShape(shape);
    setNodes((nds) =>
      nds.map((n) => (idSet.has(n.id) ? { ...n, type, data: { ...n.data, shape } } : n)),
    );
  };

  const applyColor = (color: string | undefined) => {
    setNodeColor(nodeIds, color);
    setNodes((nds) => nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, color } } : n)));
  };

  const applyBorderColor = (borderColor: string | undefined) => {
    setNodeBorderColor(nodeIds, borderColor);
    setNodes((nds) =>
      nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, borderColor } } : n)),
    );
  };

  const applyFontSize = (size: number) => {
    const next = clampFont(size);
    setNodeFontSize(nodeIds, next);
    setNodes((nds) =>
      nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, fontSize: next } } : n)),
    );
    return next;
  };

  const applyTextAlign = (align: 'left' | 'center' | 'right') => {
    setNodeTextAlign(nodeIds, align);
    setNodes((nds) =>
      nds.map((n) => (idSet.has(n.id) ? { ...n, data: { ...n.data, textAlign: align } } : n)),
    );
  };

  const effectiveFont = currentFontSize ?? FONT_DEFAULT;
  const [fontDraft, setFontDraft] = useState<string>(
    currentFontSize == null ? '' : String(currentFontSize),
  );

  // Keep input in sync when selection changes or font is changed elsewhere.
  // Show blank when font size is mixed across the selection.
  useEffect(() => {
    setFontDraft(currentFontSize == null ? '' : String(currentFontSize));
  }, [currentFontSize, nodeIds.join(',')]);

  const commitFontDraft = () => {
    if (fontDraft.trim() === '') {
      // Empty input is a no-op (preserves mixed state)
      setFontDraft(currentFontSize == null ? '' : String(currentFontSize));
      return;
    }
    const parsed = parseInt(fontDraft, 10);
    if (!Number.isFinite(parsed)) {
      setFontDraft(currentFontSize == null ? '' : String(currentFontSize));
      return;
    }
    const next = applyFontSize(parsed);
    setFontDraft(String(next));
  };

  if (nodeIds.length === 0) return null;

  return (
    <NodeToolbar nodeId={nodeIds} isVisible position={Position.Top} align="start" offset={48}>
      <div
        className="node-toolbar nodrag nopan"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
        onDoubleClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="node-toolbar__drag-handle"
          title="Move toolbar"
          aria-label="Move toolbar"
          {...dragHandleProps}
        >
          ⋮⋮
        </button>
        <div className="node-toolbar__group" role="group" aria-label="Shape">
          {SHAPE_OPTIONS.map((opt) => (
            <button
              key={opt.shape}
              type="button"
              className={`node-toolbar__btn${currentShape === opt.shape ? ' is-active' : ''}`}
              title={opt.label}
              onClick={() => applyShape(opt.shape)}
            >
              {opt.glyph}
            </button>
          ))}
        </div>

        <div className="node-toolbar__divider" />

        <ColorPicker
          value={currentColor}
          onChange={applyColor}
          title="Node fill colour"
          allowReset
          noColorValue={NO_FILL_COLOR}
        />
        <ColorPicker
          value={currentBorderColor}
          onChange={applyBorderColor}
          label="□"
          title="Node border colour"
          allowReset
        />

        <div className="node-toolbar__divider" />

        <div className="node-toolbar__group" role="group" aria-label="Font size">
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--small"
            title="Decrease font size"
            onClick={() => applyFontSize(effectiveFont - FONT_STEP)}
            disabled={effectiveFont <= FONT_MIN}
          >
            a
          </button>
          <input
            type="number"
            className="node-toolbar__font-input"
            min={FONT_MIN}
            max={FONT_MAX}
            value={fontDraft}
            placeholder={currentFontSize == null ? '—' : undefined}
            title="Font size (px)"
            aria-label="Font size in pixels"
            onChange={(e) => setFontDraft(e.target.value)}
            onBlur={commitFontDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitFontDraft();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setFontDraft(currentFontSize == null ? '' : String(currentFontSize));
                (e.target as HTMLInputElement).blur();
              }
              e.stopPropagation();
            }}
          />
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--large"
            title="Increase font size"
            onClick={() => applyFontSize(effectiveFont + FONT_STEP)}
            disabled={effectiveFont >= FONT_MAX}
          >
            A
          </button>
        </div>

        {allTextShape && (
          <>
            <div className="node-toolbar__divider" />
            <div className="node-toolbar__group" role="group" aria-label="Text alignment">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={`node-toolbar__btn${currentTextAlign === align ? ' is-active' : ''}`}
                  title={`Align ${align}`}
                  onClick={() => applyTextAlign(align)}
                >
                  <AlignIcon align={align} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </NodeToolbar>
  );
}
