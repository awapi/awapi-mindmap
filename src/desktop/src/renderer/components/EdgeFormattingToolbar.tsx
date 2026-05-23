import { useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { ViewportPortal, useReactFlow, MarkerType, type EdgeMarkerType } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';
import type { EdgeMarker, EdgeStyle } from '../types/mindmap.js';
import { useDraggableToolbar } from '../hooks/useDraggableToolbar.js';
import { ColorPicker } from './ColorPicker.js';

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

function nodeCenter(node: ReturnType<ReturnType<typeof useReactFlow>['getNodes']>[number]): {
  x: number;
  y: number;
} {
  const width = (node.measured?.width ?? node.width ?? 80) as number;
  const height = (node.measured?.height ?? node.height ?? 40) as number;
  return { x: node.position.x + width / 2, y: node.position.y + height / 2 };
}

interface IconDropdownOption<T extends string> {
  value: T;
  label: string;
  glyph: string;
}

interface IconDropdownProps<T extends string> {
  ariaLabel: string;
  titlePrefix: string;
  value: T | undefined;
  fallbackValue: T;
  options: Array<IconDropdownOption<T>>;
  onChange: (value: T) => void;
}

function IconDropdown<T extends string>({
  ariaLabel,
  titlePrefix,
  value,
  fallbackValue,
  options,
  onChange,
}: IconDropdownProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const effectiveValue = value ?? fallbackValue;
  const selected = options.find((option) => option.value === effectiveValue) ?? options[0]!;
  const mixed = value === undefined;

  useEffect(() => {
    if (!open) return;
    const handler = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  return (
    <div ref={ref} className="node-toolbar__dropdown">
      <button
        type="button"
        className={`node-toolbar__select-btn${open ? ' is-active' : ''}`}
        title={mixed ? `${titlePrefix}: Mixed` : `${titlePrefix}: ${selected.label}`}
        aria-label={mixed ? `${ariaLabel}: Mixed` : `${ariaLabel}: ${selected.label}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="node-toolbar__select-glyph">{mixed ? '—' : selected.glyph}</span>
        <span className="node-toolbar__select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="node-toolbar__menu" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`node-toolbar__menu-item${option.value === effectiveValue && !mixed ? ' is-active' : ''}`}
              title={option.label}
              role="menuitemradio"
              aria-checked={option.value === effectiveValue && !mixed}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="node-toolbar__menu-glyph">{option.glyph}</span>
              <span className="node-toolbar__menu-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const { setEdges, getEdges, getNodes } = useReactFlow();

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

  // Effective marker-end defaults to 'arrowclosed' when unset (matches toFlowEdge default).
  const effectiveMarkerEnd: EdgeMarker | undefined =
    currentMarkerEnd === undefined ? 'arrowclosed' : currentMarkerEnd;
  const effectiveMarkerStart: EdgeMarker | undefined =
    currentMarkerStart === undefined ? 'none' : currentMarkerStart;
  const selectedEdgeKey = edgeIds.join(',');
  const { offset, dragHandleProps } = useDraggableToolbar(selectedEdgeKey);

  const anchor = useMemo(() => {
    const selectedIds = new Set(edgeIds);
    const flowEdges = getEdges().filter((edge) => selectedIds.has(edge.id));
    if (flowEdges.length === 0) return null;
    const flowNodes = getNodes();
    const points = flowEdges
      .map((edge) => {
        const source = flowNodes.find((node) => node.id === edge.source);
        const target = flowNodes.find((node) => node.id === edge.target);
        if (!source || !target) return null;
        const sourceCenter = nodeCenter(source);
        const targetCenter = nodeCenter(target);
        return {
          x: (sourceCenter.x + targetCenter.x) / 2,
          y: (sourceCenter.y + targetCenter.y) / 2,
        };
      })
      .filter((point): point is { x: number; y: number } => point != null);
    if (points.length === 0) return null;
    return {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    };
  }, [selectedEdgeKey, getEdges, getNodes]);

  if (edgeIds.length === 0 || !anchor) return null;

  return (
    <ViewportPortal>
      <div
        className="node-toolbar edge-toolbar nodrag nopan"
        style={
          {
            left: anchor.x,
            top: anchor.y,
            '--toolbar-offset-x': `${offset.x}px`,
            '--toolbar-offset-y': `${offset.y}px`,
          } as React.CSSProperties
        }
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
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
        <IconDropdown
          ariaLabel="Edge style"
          titlePrefix="Edge style"
          value={currentStyle}
          fallbackValue="default"
          options={STYLE_OPTIONS}
          onChange={applyStyle}
        />

        <div className="node-toolbar__divider" />

        <ColorPicker
          value={currentColor}
          onChange={applyColor}
          title="Edge colour"
          allowReset
        />

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
          <span className="node-toolbar__label" title="Source end">
            S:
          </span>
          <IconDropdown
            ariaLabel="Source arrow"
            titlePrefix="Source arrow"
            value={effectiveMarkerStart}
            fallbackValue="none"
            options={MARKER_OPTIONS}
            onChange={applyMarkerStart}
          />
        </div>

        <div className="node-toolbar__divider" />

        <div className="node-toolbar__group" role="group" aria-label="Target arrow">
          <span className="node-toolbar__label" title="Target end">
            T:
          </span>
          <IconDropdown
            ariaLabel="Target arrow"
            titlePrefix="Target arrow"
            value={effectiveMarkerEnd}
            fallbackValue="arrowclosed"
            options={MARKER_OPTIONS}
            onChange={applyMarkerEnd}
          />
        </div>
      </div>
    </ViewportPortal>
  );
}
