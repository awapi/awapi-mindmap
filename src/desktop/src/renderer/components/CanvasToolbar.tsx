import { useState, useEffect, useRef } from 'react';
import type { JSX } from 'react';

export type ActiveTool = 'select' | 'sticky' | 'comment';
export type ExportType = 'png' | 'svg' | 'text' | 'markdown';

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
