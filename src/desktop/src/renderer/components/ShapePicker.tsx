import { useEffect, useRef } from 'react';
import type { JSX } from 'react';
import type { NodeShape } from '../types/mindmap.js';

interface ShapePickerProps {
  x: number;
  y: number;
  onSelect: (shape: NodeShape) => void;
  onClose: () => void;
}

const SHAPES: Array<{ shape: NodeShape; label: string }> = [
  { shape: 'rectangle', label: 'Rect' },
  { shape: 'circle', label: 'Circle' },
  { shape: 'ellipse', label: 'Ellipse' },
  { shape: 'diamond', label: 'Diamond' },
  { shape: 'text', label: 'Text' },
];

export function ShapePicker({ x, y, onSelect, onClose }: ShapePickerProps): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay so the mouseup that ended the drag doesn't immediately close it
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown);
    }, 100);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [onClose]);

  return (
    <div ref={ref} className="shape-picker" style={{ left: x, top: y }}>
      <div className="shape-picker__label">Add node</div>
      <div className="shape-picker__options">
        {SHAPES.map(({ shape, label }) => (
          <button
            key={shape}
            className="shape-picker__btn"
            title={label}
            onClick={() => {
              onSelect(shape);
              onClose();
            }}
          >
            <span className={`shape-picker__icon shape-picker__icon--${shape}`} />
            <span className="shape-picker__name">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
