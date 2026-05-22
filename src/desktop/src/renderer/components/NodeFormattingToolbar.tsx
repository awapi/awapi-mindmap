import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';
import type { NodeShape } from '../types/mindmap.js';

interface NodeFormattingToolbarProps {
  nodeId: string;
  selected: boolean;
  currentShape: NodeShape;
  currentFontSize?: number;
  currentTextAlign?: 'left' | 'center' | 'right';
}

const SHAPE_OPTIONS: Array<{ shape: NodeShape; label: string; glyph: string }> = [
  { shape: 'rectangle', label: 'Rectangle', glyph: '▭' },
  { shape: 'circle', label: 'Circle', glyph: '○' },
  { shape: 'ellipse', label: 'Ellipse', glyph: '⬭' },
  { shape: 'diamond', label: 'Diamond', glyph: '◇' },
  { shape: 'text', label: 'Text only', glyph: 'T' },
];

const COLOUR_OPTIONS: Array<{ color: string; title: string }> = [
  { color: '#e94560', title: 'Red' },
  { color: '#f5a623', title: 'Orange' },
  { color: '#f8e71c', title: 'Yellow' },
  { color: '#7ed321', title: 'Green' },
  { color: '#4a90e2', title: 'Blue' },
  { color: '#9b59b6', title: 'Purple' },
  { color: '#1abc9c', title: 'Teal' },
];

const FONT_MIN = 6;
const FONT_MAX = 96;
const FONT_DEFAULT = 10;
const FONT_STEP = 2;

const clampFont = (n: number) => Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));

/** Excel-style alignment icon: four stacked horizontal bars positioned by alignment. */
function AlignIcon({ align }: { align: 'left' | 'center' | 'right' }): JSX.Element {
  // Bar geometry: alternating long/short widths so the alignment is clearly visible.
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
  nodeId,
  selected,
  currentShape,
  currentFontSize,
  currentTextAlign,
}: NodeFormattingToolbarProps): JSX.Element {
  const setNodeShape = useMindMapStore((s) => s.setNodeShape);
  const setNodeColor = useMindMapStore((s) => s.setNodeColor);
  const setNodeFontSize = useMindMapStore((s) => s.setNodeFontSize);
  const setNodeTextAlign = useMindMapStore((s) => s.setNodeTextAlign);
  const { setNodes } = useReactFlow();

  const applyShape = (shape: NodeShape) => {
    setNodeShape(nodeId, shape);
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, shape } } : n)));
  };

  const applyColor = (color: string | undefined) => {
    setNodeColor(nodeId, color);
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, color } } : n)),
    );
  };

  const applyFontSize = (size: number) => {
    const next = clampFont(size);
    setNodeFontSize(nodeId, next);
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, fontSize: next } } : n)),
    );
    return next;
  };

  const applyTextAlign = (align: 'left' | 'center' | 'right') => {
    setNodeTextAlign(nodeId, align);
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, textAlign: align } } : n)),
    );
  };

  const effectiveFont = currentFontSize ?? FONT_DEFAULT;
  const [fontDraft, setFontDraft] = useState<string>(String(effectiveFont));

  // Keep the input in sync when the node's font size changes from elsewhere
  // (undo/redo, A+/A- buttons, switching selection).
  useEffect(() => {
    setFontDraft(String(effectiveFont));
  }, [effectiveFont, nodeId]);

  const commitFontDraft = () => {
    const parsed = parseInt(fontDraft, 10);
    if (!Number.isFinite(parsed)) {
      setFontDraft(String(effectiveFont));
      return;
    }
    const next = applyFontSize(parsed);
    setFontDraft(String(next));
  };

  return (
    <NodeToolbar isVisible={selected} position={Position.Top} align="start" offset={48}>
      <div
        className="node-toolbar nodrag nopan"
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
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

        <div className="node-toolbar__group" role="group" aria-label="Colour">
          {COLOUR_OPTIONS.map((opt) => (
            <button
              key={opt.color}
              type="button"
              className="node-toolbar__swatch"
              style={{ background: opt.color }}
              title={opt.title}
              onClick={() => applyColor(opt.color)}
            />
          ))}
          <button
            type="button"
            className="node-toolbar__swatch node-toolbar__swatch--reset"
            title="Reset colour"
            onClick={() => applyColor(undefined)}
          >
            ⊘
          </button>
        </div>

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
                setFontDraft(String(effectiveFont));
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

        {currentShape === 'text' && (
          <>
            <div className="node-toolbar__divider" />
            <div className="node-toolbar__group" role="group" aria-label="Text alignment">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  className={`node-toolbar__btn${(currentTextAlign ?? 'center') === align ? ' is-active' : ''}`}
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
