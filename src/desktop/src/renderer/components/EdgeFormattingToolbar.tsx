import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Panel, useReactFlow, MarkerType, type EdgeMarkerType } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';
import type { EdgeMarker, EdgeStyle } from '../types/mindmap.js';

interface EdgeFormattingToolbarProps {
  /** IDs of all selected edges the toolbar applies changes to. */
  edgeIds: string[];
  /** Shared edge style across all selected edges, or undefined if mixed. */
  currentStyle: EdgeStyle | undefined;
  /** Shared stroke colour across all selected edges, or undefined if mixed. */
  currentColor: string | undefined;
  /** Shared stroke width across all selected edges, or undefined if mixed. */
  currentWidth: number | undefined;
  /** Shared marker-start across all selected edges, or undefined if mixed. */
  currentMarkerStart: EdgeMarker | undefined;
  /** Shared marker-end across all selected edges, or undefined if mixed. */
  currentMarkerEnd: EdgeMarker | undefined;
}

const COLOUR_OPTIONS: Array<{ color: string; title: string }> = [
  { color: '#e94560', title: 'Red' },
  { color: '#f5a623', title: 'Orange' },
  { color: '#f8e71c', title: 'Yellow' },
  { color: '#7ed321', title: 'Green' },
  { color: '#4a90e2', title: 'Blue' },
  { color: '#9b59b6', title: 'Purple' },
  { color: '#1abc9c', title: 'Teal' },
];

const STYLE_OPTIONS: Array<{ value: EdgeStyle; label: string; glyph: string }> = [
  { value: 'default', label: 'Curved', glyph: '⌒' },
  { value: 'straight', label: 'Straight', glyph: '─' },
  { value: 'step', label: 'Step', glyph: '⌐' },
  { value: 'smoothstep', label: 'Smooth step', glyph: '⌒⌐' },
];

const MARKER_OPTIONS: Array<{ value: EdgeMarker; label: string; glyph: string }> = [
  { value: 'none', label: 'No arrow', glyph: '—' },
  { value: 'arrow', label: 'Open arrow', glyph: '➔' },
  { value: 'arrowclosed', label: 'Filled arrow', glyph: '➤' },
];

const WIDTH_MIN = 1;
const WIDTH_MAX = 12;
const WIDTH_DEFAULT = 1.5;
const WIDTH_STEP = 1;

const clampWidth = (n: number) => Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, Math.round(n)));

function markerToRf(marker: EdgeMarker | undefined): EdgeMarkerType | undefined {
  if (!marker || marker === 'none') return undefined;
  return { type: marker === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed };
}

export function EdgeFormattingToolbar({
  edgeIds,
  currentStyle,
  currentColor,
  currentWidth,
  currentMarkerStart,
  currentMarkerEnd,
}: EdgeFormattingToolbarProps): JSX.Element | null {
  const setEdgeStyle = useMindMapStore((s) => s.setEdgeStyle);
  const setEdgeColor = useMindMapStore((s) => s.setEdgeColor);
  const setEdgeWidth = useMindMapStore((s) => s.setEdgeWidth);
  const setEdgeMarkerStart = useMindMapStore((s) => s.setEdgeMarkerStart);
  const setEdgeMarkerEnd = useMindMapStore((s) => s.setEdgeMarkerEnd);
  const { setEdges } = useReactFlow();

  const idSet = new Set(edgeIds);

  const applyStyle = (style: EdgeStyle) => {
    edgeIds.forEach((id) => setEdgeStyle(id, style));
    setEdges((eds) => eds.map((e) => (idSet.has(e.id) ? { ...e, type: style } : e)));
  };

  const applyColor = (color: string | undefined) => {
    setEdgeColor(edgeIds, color);
    setEdges((eds) =>
      eds.map((e) => {
        if (!idSet.has(e.id)) return e;
        const style = { ...(e.style ?? {}) };
        if (color) style.stroke = color;
        else delete style.stroke;
        return { ...e, style };
      }),
    );
  };

  const applyWidth = (width: number) => {
    const next = clampWidth(width);
    setEdgeWidth(edgeIds, next);
    setEdges((eds) =>
      eds.map((e) =>
        idSet.has(e.id) ? { ...e, style: { ...(e.style ?? {}), strokeWidth: next } } : e,
      ),
    );
    return next;
  };

  const applyMarkerStart = (marker: EdgeMarker) => {
    setEdgeMarkerStart(edgeIds, marker);
    const rf = markerToRf(marker);
    setEdges((eds) =>
      eds.map((e) => {
        if (!idSet.has(e.id)) return e;
        const next = { ...e };
        if (rf) next.markerStart = rf;
        else delete next.markerStart;
        return next;
      }),
    );
  };

  const applyMarkerEnd = (marker: EdgeMarker) => {
    setEdgeMarkerEnd(edgeIds, marker);
    const rf = markerToRf(marker);
    setEdges((eds) =>
      eds.map((e) => {
        if (!idSet.has(e.id)) return e;
        const next = { ...e };
        if (rf) next.markerEnd = rf;
        else delete next.markerEnd;
        return next;
      }),
    );
  };

  const effectiveWidth = currentWidth ?? WIDTH_DEFAULT;
  const [widthDraft, setWidthDraft] = useState<string>(
    currentWidth == null ? '' : String(currentWidth),
  );

  useEffect(() => {
    setWidthDraft(currentWidth == null ? '' : String(currentWidth));
  }, [currentWidth, edgeIds.join(',')]);

  const commitWidthDraft = () => {
    if (widthDraft.trim() === '') {
      setWidthDraft(currentWidth == null ? '' : String(currentWidth));
      return;
    }
    const parsed = parseFloat(widthDraft);
    if (!Number.isFinite(parsed)) {
      setWidthDraft(currentWidth == null ? '' : String(currentWidth));
      return;
    }
    const next = applyWidth(parsed);
    setWidthDraft(String(next));
  };

  if (edgeIds.length === 0) return null;

  // Effective marker-end defaults to 'arrowclosed' when unset (matches toFlowEdge default).
  const effectiveMarkerEnd: EdgeMarker | undefined =
    currentMarkerEnd === undefined ? 'arrowclosed' : currentMarkerEnd;
  const effectiveMarkerStart: EdgeMarker | undefined =
    currentMarkerStart === undefined ? 'none' : currentMarkerStart;

  return (
    <Panel position="top-center">
      <div
        className="node-toolbar nodrag nopan"
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="node-toolbar__group" role="group" aria-label="Edge style">
          {STYLE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`node-toolbar__btn${currentStyle === opt.value ? ' is-active' : ''}`}
              title={opt.label}
              onClick={() => applyStyle(opt.value)}
            >
              {opt.glyph}
            </button>
          ))}
        </div>

        <div className="node-toolbar__divider" />

        <div className="node-toolbar__group" role="group" aria-label="Edge colour">
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

        <div className="node-toolbar__group" role="group" aria-label="Edge width">
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--small"
            title="Decrease width"
            onClick={() => applyWidth(effectiveWidth - WIDTH_STEP)}
            disabled={effectiveWidth <= WIDTH_MIN}
          >
            −
          </button>
          <input
            type="number"
            className="node-toolbar__font-input"
            min={WIDTH_MIN}
            max={WIDTH_MAX}
            value={widthDraft}
            placeholder={currentWidth == null ? '—' : undefined}
            title="Stroke width (px)"
            aria-label="Stroke width in pixels"
            onChange={(e) => setWidthDraft(e.target.value)}
            onBlur={commitWidthDraft}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitWidthDraft();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setWidthDraft(currentWidth == null ? '' : String(currentWidth));
                (e.target as HTMLInputElement).blur();
              }
              e.stopPropagation();
            }}
          />
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--large"
            title="Increase width"
            onClick={() => applyWidth(effectiveWidth + WIDTH_STEP)}
            disabled={effectiveWidth >= WIDTH_MAX}
          >
            +
          </button>
        </div>

        <div className="node-toolbar__divider" />

        <div className="node-toolbar__group" role="group" aria-label="Source arrow">
          <span className="node-toolbar__label" title="Source end">S:</span>
          {MARKER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`node-toolbar__btn${effectiveMarkerStart === opt.value ? ' is-active' : ''}`}
              title={opt.label}
              onClick={() => applyMarkerStart(opt.value)}
            >
              {opt.glyph}
            </button>
          ))}
        </div>

        <div className="node-toolbar__divider" />

        <div className="node-toolbar__group" role="group" aria-label="Target arrow">
          <span className="node-toolbar__label" title="Target end">T:</span>
          {MARKER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`node-toolbar__btn${effectiveMarkerEnd === opt.value ? ' is-active' : ''}`}
              title={opt.label}
              onClick={() => applyMarkerEnd(opt.value)}
            >
              {opt.glyph}
            </button>
          ))}
        </div>
      </div>
    </Panel>
  );
}
