import { useEffect, useRef } from 'react';
import type { JSX } from 'react';

export interface ContextMenuSwatch {
  color: string;
  title: string;
  onClick: () => void;
}

export interface ContextMenuAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Render a visual separator before this item. */
  dividerBefore?: boolean;
  /**
   * When present, renders a row of colour swatches below the label instead of
   * a regular button. `onClick` is unused when swatches are provided.
   */
  swatches?: ContextMenuSwatch[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: ContextMenuProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [onClose]);

  return (
    <div ref={ref} className="context-menu" style={{ left: x, top: y }}>
      {actions.map((action) => (
        <div key={action.label}>
          {action.dividerBefore && <hr className="context-menu__divider" />}
          {action.swatches ? (
            <div className="context-menu__swatch-row">
              <div className="context-menu__swatch-label">{action.label}</div>
              <div className="context-menu__swatches">
                {action.swatches.map((s) => (
                  <button
                    key={s.color}
                    className={`context-menu__swatch${s.color === 'reset' ? ' context-menu__swatch--reset' : ''}`}
                    style={s.color !== 'reset' ? { background: s.color } : undefined}
                    title={s.title}
                    onClick={() => { s.onClick(); onClose(); }}
                  >
                    {s.color === 'reset' ? 'Reset' : null}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <button
              className="context-menu__item"
              disabled={action.disabled}
              onClick={() => {
                action.onClick();
                onClose();
              }}
            >
              {action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
