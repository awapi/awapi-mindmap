import { useState, useRef, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';

export function StickyNote({ id, data, selected }: NodeProps): JSX.Element {
  const renameNode = useMindMapStore((s) => s.renameNode);
  const resizeNode = useMindMapStore((s) => s.resizeNode);
  const { setNodes } = useReactFlow();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data.label ?? ''));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep draft in sync on external changes (undo/redo)
  useEffect(() => {
    if (!editing) setDraft(String(data.label ?? ''));
  }, [data.label, editing]);

  // Auto-grow the textarea height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  });

  const commitEdit = useCallback(() => {
    const trimmed = draft.replace(/\s+$/, '');
    if (trimmed && trimmed !== String(data.label ?? '')) {
      renameNode(id, trimmed);
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n)),
      );
    }
    setEditing(false);
  }, [draft, data.label, id, renameNode, setNodes]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(String(data.label ?? ''));
      setEditing(true);
    },
    [data.label],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        setEditing(false);
        setDraft(String(data.label ?? ''));
      }
      // Shift+Enter = newline; bare Enter = commit
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        commitEdit();
      }
    },
    [commitEdit, data.label],
  );

  const bgColor = (data.color as string | undefined) ?? '#fef3c7';

  return (
    <div
      className={`sticky-note${selected ? ' selected' : ''}`}
      style={{ background: bgColor }}
      onDoubleClick={handleDoubleClick}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        onResizeEnd={(_e, params) =>
          resizeNode(id, params.width, params.height, { x: params.x, y: params.y })
        }
      />
      <Handle id="top-t" type="target" position={Position.Top} />
      <Handle id="right-t" type="target" position={Position.Right} />
      <Handle id="bottom-t" type="target" position={Position.Bottom} />
      <Handle id="left-t" type="target" position={Position.Left} />
      <Handle id="top" type="source" position={Position.Top} />
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      <Handle id="left" type="source" position={Position.Left} />
      {editing ? (
        <textarea
          ref={textareaRef}
          className="sticky-note__input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <span className="sticky-note__label">{String(data.label || 'Double-click to edit…')}</span>
      )}
    </div>
  );
}
