import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { EdgeMarker, EdgeStyle, NodeShape } from '../types/mindmap.js';
import { ColorPicker } from './ColorPicker.js';

export type ActiveTool = 'select' | 'sticky' | 'comment';
export type ExportType = 'png' | 'svg' | 'text' | 'markdown';

export interface DefaultStyleSettings {
  nodeShape: NodeShape;
  nodeColor?: string;
  nodeTextColor?: string;
  nodeFontSize: number;
  edgeStyle: EdgeStyle;
  edgeColor?: string;
  edgeWidth: number;
  edgeMarkerEnd: EdgeMarker;
}

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  onAddNode: () => void;
  onAutoLayout: () => void;
  onFitView: () => void;
  onExport: (type: ExportType) => void;
  showGrid: boolean;
  onToggleGrid: () => void;
}

interface DefaultStylesToolbarProps {
  defaultStyles: DefaultStyleSettings;
  onDefaultStylesChange: (styles: DefaultStyleSettings) => void;
}

function IconAdd(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5 V19 M5 12 H19" />
    </svg>
  );
}

function IconSelect(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M5 3 L5 18 L9.5 13.5 L12 20 L14 19.2 L11.5 12.8 L18 12.8 Z" />
    </svg>
  );
}

function IconSticky(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4 H15 V17 L11 21 H4 Z" />
      <path d="M15 17 H11 V21" />
    </svg>
  );
}

function IconComment(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4 H20 V15 H9 L5 19 V15 H4 Z" />
    </svg>
  );
}

function IconAutoLayout(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* Central node */}
      <circle cx="12" cy="12" r="2.5" />
      {/* Child nodes */}
      <circle cx="12" cy="4" r="1.8" />
      <circle cx="20" cy="16" r="1.8" />
      <circle cx="4" cy="16" r="1.8" />
      {/* Edges */}
      <line x1="12" y1="9.5" x2="12" y2="5.8" />
      <line x1="13.8" y1="13.4" x2="18.2" y2="14.8" />
      <line x1="10.2" y1="13.4" x2="5.8" y2="14.8" />
    </svg>
  );
}

function IconFitView(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9 V3 H9" />
      <path d="M21 9 V3 H15" />
      <path d="M3 15 V21 H9" />
      <path d="M21 15 V21 H15" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  );
}

function IconGrid(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  );
}

function IconExport(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3 V15" />
      <path d="M8 11 L12 15 L16 11" />
      <path d="M4 17 V19 A2 2 0 0 0 6 21 H18 A2 2 0 0 0 20 19 V17" />
    </svg>
  );
}

const TOOLS: { id: ActiveTool; label: string; title: string; Icon: () => JSX.Element }[] = [
  { id: 'select', label: 'Select', title: 'Select (V)', Icon: IconSelect },
  { id: 'sticky', label: 'Note', title: 'Sticky Note (S)', Icon: IconSticky },
  { id: 'comment', label: 'Comment', title: 'Comment (C)', Icon: IconComment },
];

const EXPORT_OPTIONS: { type: ExportType; label: string; sublabel: string }[] = [
  { type: 'png', label: 'PNG Image', sublabel: 'Full graph, raster' },
  { type: 'svg', label: 'SVG Image', sublabel: 'Full graph, vector' },
  { type: 'text', label: 'Plain Text', sublabel: 'Indented outline' },
  { type: 'markdown', label: 'Markdown', sublabel: 'Nested list' },
];

const NODE_SHAPES: Array<{ value: NodeShape; label: string; glyph: string }> = [
  { value: 'rectangle', label: 'Rectangle', glyph: '▭' },
  { value: 'circle', label: 'Circle', glyph: '○' },
  { value: 'ellipse', label: 'Ellipse', glyph: '⬭' },
  { value: 'diamond', label: 'Diamond', glyph: '◇' },
  { value: 'text', label: 'Text only', glyph: 'T' },
  { value: 'sticky', label: 'Sticky note', glyph: '◰' },
  { value: 'comment', label: 'Comment', glyph: '▱' },
];

const EDGE_STYLES: Array<{ value: EdgeStyle; label: string; glyph: string }> = [
  { value: 'default', label: 'Curved', glyph: '⌒' },
  { value: 'straight', label: 'Straight', glyph: '─' },
  { value: 'step', label: 'Step', glyph: '⌐' },
  { value: 'smoothstep', label: 'Smooth step', glyph: '⌒⌐' },
];

const EDGE_MARKERS: Array<{ value: EdgeMarker; label: string; glyph: string }> = [
  { value: 'none', label: 'No arrow', glyph: '—' },
  { value: 'arrow', label: 'Open arrow', glyph: '➔' },
  { value: 'arrowclosed', label: 'Filled arrow', glyph: '➤' },
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface IconDropdownOption<T extends string> {
  value: T;
  label: string;
  glyph: string;
}

interface IconDropdownProps<T extends string> {
  ariaLabel: string;
  titlePrefix: string;
  value: T;
  options: Array<IconDropdownOption<T>>;
  onChange: (value: T) => void;
}

function IconDropdown<T extends string>({
  ariaLabel,
  titlePrefix,
  value,
  options,
  onChange,
}: IconDropdownProps<T>): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0]!;

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
    <div ref={ref} className="top-defaults-toolbar__dropdown">
      <button
        type="button"
        className={`top-defaults-toolbar__select-btn${open ? ' is-active' : ''}`}
        title={`${titlePrefix}: ${selected.label}`}
        aria-label={`${ariaLabel}: ${selected.label}`}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="top-defaults-toolbar__select-glyph">{selected.glyph}</span>
        <span className="top-defaults-toolbar__select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div className="top-defaults-toolbar__menu" role="menu">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`top-defaults-toolbar__menu-item${option.value === value ? ' is-active' : ''}`}
              title={option.label}
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              <span className="top-defaults-toolbar__menu-glyph">{option.glyph}</span>
              <span className="top-defaults-toolbar__menu-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DefaultStylesToolbar({
  defaultStyles,
  onDefaultStylesChange,
}: DefaultStylesToolbarProps): JSX.Element {
  const updateDefaults = (patch: Partial<DefaultStyleSettings>) => {
    onDefaultStylesChange({ ...defaultStyles, ...patch });
  };

  return (
    <div className="top-defaults-toolbar" role="toolbar" aria-label="Default styles">
      <span className="top-defaults-toolbar__label">Defaults</span>
      <IconDropdown
        ariaLabel="Default node shape"
        titlePrefix="Default shape"
        value={defaultStyles.nodeShape}
        options={NODE_SHAPES}
        onChange={(nodeShape) => updateDefaults({ nodeShape })}
      />
      <ColorPicker
        value={defaultStyles.nodeColor}
        onChange={(nodeColor) => updateDefaults({ nodeColor })}
        title="Default node fill colour"
        allowReset
      />
      <ColorPicker
        value={defaultStyles.nodeTextColor}
        onChange={(nodeTextColor) => updateDefaults({ nodeTextColor })}
        label="A"
        title="Default text colour"
        allowReset
      />
      <label
        className="top-defaults-toolbar__field top-defaults-toolbar__field--number"
        title="Default text size"
      >
        <span>Text</span>
        <button
          type="button"
          className="top-defaults-toolbar__btn top-defaults-toolbar__font top-defaults-toolbar__font--small"
          title="Decrease default text size"
          disabled={defaultStyles.nodeFontSize <= 6}
          onClick={() => updateDefaults({ nodeFontSize: defaultStyles.nodeFontSize - 2 })}
        >
          a
        </button>
        <input
          type="number"
          min={6}
          max={96}
          value={defaultStyles.nodeFontSize}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) {
              updateDefaults({ nodeFontSize: clampNumber(Math.round(parsed), 6, 96) });
            }
          }}
        />
        <button
          type="button"
          className="top-defaults-toolbar__btn top-defaults-toolbar__font top-defaults-toolbar__font--large"
          title="Increase default text size"
          disabled={defaultStyles.nodeFontSize >= 96}
          onClick={() => updateDefaults({ nodeFontSize: defaultStyles.nodeFontSize + 2 })}
        >
          A
        </button>
      </label>
      <div className="top-defaults-toolbar__divider" />
      <IconDropdown
        ariaLabel="Default line type"
        titlePrefix="Default line"
        value={defaultStyles.edgeStyle}
        options={EDGE_STYLES}
        onChange={(edgeStyle) => updateDefaults({ edgeStyle })}
      />
      <ColorPicker
        value={defaultStyles.edgeColor}
        onChange={(edgeColor) => updateDefaults({ edgeColor })}
        title="Default line colour"
        allowReset
      />
      <label
        className="top-defaults-toolbar__field top-defaults-toolbar__field--number"
        title="Default line width"
      >
        <span>Width</span>
        <button
          type="button"
          className="top-defaults-toolbar__btn top-defaults-toolbar__font"
          title="Decrease default line width"
          disabled={defaultStyles.edgeWidth <= 1}
          onClick={() => updateDefaults({ edgeWidth: clampNumber(defaultStyles.edgeWidth - 0.5, 1, 12) })}
        >
          −
        </button>
        <input
          type="number"
          min={1}
          max={12}
          step={0.5}
          value={defaultStyles.edgeWidth}
          onChange={(e) => {
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) {
              updateDefaults({ edgeWidth: clampNumber(parsed, 1, 12) });
            }
          }}
        />
        <button
          type="button"
          className="top-defaults-toolbar__btn top-defaults-toolbar__font"
          title="Increase default line width"
          disabled={defaultStyles.edgeWidth >= 12}
          onClick={() => updateDefaults({ edgeWidth: clampNumber(defaultStyles.edgeWidth + 0.5, 1, 12) })}
        >
          +
        </button>
      </label>
      <IconDropdown
        ariaLabel="Default target arrow"
        titlePrefix="Default arrow"
        value={defaultStyles.edgeMarkerEnd}
        options={EDGE_MARKERS}
        onChange={(edgeMarkerEnd) => updateDefaults({ edgeMarkerEnd })}
      />
    </div>
  );
}

export function CanvasToolbar({
  activeTool,
  onToolChange,
  onAddNode,
  onAutoLayout,
  onFitView,
  onExport,
  showGrid,
  onToggleGrid,
}: Props): JSX.Element {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close export dropdown on outside pointer-down
  useEffect(() => {
    if (!exportOpen) return;
    const handler = (e: PointerEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [exportOpen]);

  return (
    <div className="float-toolbar" role="toolbar" aria-label="Canvas tools">
      {TOOLS.filter((t) => t.id === 'select').map(({ id, label, title, Icon }) => (
        <button
          key={id}
          className={`float-toolbar__btn${activeTool === id ? ' active' : ''}`}
          title={title}
          aria-pressed={activeTool === id}
          onClick={() => onToolChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
      <button className="float-toolbar__btn" title="Add Node" onClick={onAddNode}>
        <IconAdd />
        <span>Add</span>
      </button>
      {TOOLS.filter((t) => t.id !== 'select').map(({ id, label, title, Icon }) => (
        <button
          key={id}
          className={`float-toolbar__btn${activeTool === id ? ' active' : ''}`}
          title={title}
          aria-pressed={activeTool === id}
          onClick={() => onToolChange(id)}
        >
          <Icon />
          <span>{label}</span>
        </button>
      ))}
      <div className="float-toolbar__divider" />
      <button
        className="float-toolbar__btn"
        title="Auto Layout — radial tree (⌘⇧L / Ctrl+Shift+L)"
        onClick={onAutoLayout}
      >
        <IconAutoLayout />
        <span>Layout</span>
      </button>
      <button
        className="float-toolbar__btn"
        title="Fit to View (⌘⇧F / Ctrl+Shift+F)"
        onClick={onFitView}
      >
        <IconFitView />
        <span>Fit</span>
      </button>
      <button
        className={`float-toolbar__btn${showGrid ? ' active' : ''}`}
        title="Toggle grid"
        aria-pressed={showGrid}
        onClick={onToggleGrid}
      >
        <IconGrid />
        <span>Grid</span>
      </button>
      <div className="float-toolbar__divider" />
      <div ref={exportRef} style={{ position: 'relative' }}>
        <button
          className={`float-toolbar__btn${exportOpen ? ' active' : ''}`}
          title="Export map…"
          aria-expanded={exportOpen}
          onClick={() => setExportOpen((o) => !o)}
        >
          <IconExport />
          <span>Export</span>
        </button>
        {exportOpen && (
          <div className="float-toolbar__export-menu" role="menu">
            <div className="float-toolbar__export-header">Export as…</div>
            {EXPORT_OPTIONS.map(({ type, label, sublabel }) => (
              <button
                key={type}
                className="float-toolbar__export-item"
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  onExport(type);
                }}
              >
                <span className="float-toolbar__export-label">{label}</span>
                <span className="float-toolbar__export-sub">{sublabel}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
