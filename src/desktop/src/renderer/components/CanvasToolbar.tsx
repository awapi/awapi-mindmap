import type { JSX } from 'react';

export type ActiveTool = 'select' | 'sticky' | 'comment';

interface Props {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  onAddNode: () => void;
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

const TOOLS: { id: ActiveTool; label: string; title: string; Icon: () => JSX.Element }[] = [
  { id: 'select', label: 'Select', title: 'Select (V)', Icon: IconSelect },
  { id: 'sticky', label: 'Note', title: 'Sticky Note (S)', Icon: IconSticky },
  { id: 'comment', label: 'Comment', title: 'Comment (C)', Icon: IconComment },
];

export function CanvasToolbar({ activeTool, onToolChange, onAddNode }: Props): JSX.Element {
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
      <button
        className="float-toolbar__btn"
        title="Add Node"
        onClick={onAddNode}
      >
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
    </div>
  );
}
