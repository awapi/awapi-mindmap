import { useState, useRef, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Handle, Position, type NodeProps, useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';

export function CommentNode({ id, data, selected }: NodeProps): JSX.Element {
  const renameNode = useMindMapStore((s) => s.renameNode);
  const { setNodes } = useReactFlow();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data.label ?? ''));
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep draft in sync on external changes (undo/redo)
  useEffect(() => {
    if (!editing) setDraft(String(data.label ?? ''));
  }, [data.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Auto-grow textarea height as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !editing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  const commitEdit = useCallback(() => {
    const trimmed = draft.trim();
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
      if (e.key === 'Enter' && !e.shiftKey) commitEdit();
      if (e.key === 'Escape') {
        setEditing(false);
        setDraft(String(data.label ?? ''));
      }
    },
    [commitEdit, data.label],
  );

  return (
    <div className={`comment-node${selected ? ' selected' : ''}`} onDoubleClick={handleDoubleClick}>
      <Handle id="top-t" type="target" position={Position.Top} />
      <Handle id="right-t" type="target" position={Position.Right} />
      <Handle id="bottom-t" type="target" position={Position.Bottom} />
      <Handle id="left-t" type="target" position={Position.Left} />
      <Handle id="top" type="source" position={Position.Top} />
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      <Handle id="left" type="source" position={Position.Left} />
      <div className="comment-node__bubble">
        {editing ? (
          <textarea
            ref={inputRef}
            className="comment-node__input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            rows={Math.max(1, draft.split('\n').length)}
            autoFocus
          />
        ) : (
          <span className="comment-node__text">
            {String(data.label || 'Double-click to edit…')}
          </span>
        )}
      </div>
      {/* Tail of the speech bubble */}
      <div className="comment-node__tail" />
    </div>
  );
}
