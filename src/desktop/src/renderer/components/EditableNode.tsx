import { useState, useRef, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { useMindMapStore, useUIStore } from '../state/stores.js';
import type { NodeShape } from '../types/mindmap.js';

export function EditableNode({ id, data, selected }: NodeProps): JSX.Element {
  const renameNode = useMindMapStore((s) => s.renameNode);
  const resizeNode = useMindMapStore((s) => s.resizeNode);
  const setEditingNodeId = useUIStore((s) => s.setEditingNodeId);
  const { setNodes } = useReactFlow();
  const shape: NodeShape = (data.shape as NodeShape | undefined) ?? 'rectangle';
  const textAlign = (data.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'center';
  const color = data.color as string | undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(data.label ?? ''));
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isText = shape === 'text';

  // Keep draft in sync when label changes externally (e.g. undo/redo)
  useEffect(() => {
    if (!editing) {
      setDraft(String(data.label ?? ''));
    }
  }, [data.label, editing]);

  // Focus + select all text when editing begins
  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  // Auto-grow textarea height as user types
  useEffect(() => {
    const el = inputRef.current;
    if (!el || !editing) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  const commitEdit = useCallback(() => {
    const trimmed = isText ? draft.replace(/\s+$/, '') : draft.trim();
    if (trimmed && trimmed !== String(data.label ?? '')) {
      renameNode(id, trimmed);
      // Patch the local React Flow node data so the label renders immediately
      // without waiting for a full store→canvas sync.
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n)),
      );
    }
    setEditing(false);
    setEditingNodeId(null);
  }, [draft, data.label, id, renameNode, setNodes, isText, setEditingNodeId]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setDraft(String(data.label ?? ''));
      setEditing(true);
      setEditingNodeId(id);
    },
    [data.label, id, setEditingNodeId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter') {
        // For the text shape, Shift+Enter inserts a newline (textarea default);
        // a bare Enter commits.
        if (isText && e.shiftKey) {
          // allow newline insertion
        } else {
          e.preventDefault();
          commitEdit();
        }
      }
      if (e.key === 'Escape') {
        setEditing(false);
        setEditingNodeId(null);
      }
      // Stop propagation so the canvas keyboard handler doesn't intercept
      e.stopPropagation();
    },
    [commitEdit, isText, setEditingNodeId],
  );

  // Ensure global editing flag is cleared if this node unmounts mid-edit.
  useEffect(() => {
    return () => {
      if (editing) setEditingNodeId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Minimum dimensions per shape
  const minWidth =
    shape === 'circle'
      ? 50
      : shape === 'ellipse'
        ? 60
        : shape === 'diamond'
          ? 100
          : shape === 'text'
            ? 40
            : 80;
  const minHeight =
    shape === 'circle'
      ? 50
      : shape === 'ellipse'
        ? 40
        : shape === 'diamond'
          ? 80
          : shape === 'text'
            ? 24
            : 36;

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={minWidth}
        minHeight={minHeight}
        keepAspectRatio={shape === 'circle'}
        onResizeEnd={(_event, params) => {
          resizeNode(id, params.width, params.height, { x: params.x, y: params.y });
        }}
      />
      <Handle id="top-t" type="target" position={Position.Top} />
      <Handle id="right-t" type="target" position={Position.Right} />
      <Handle id="bottom-t" type="target" position={Position.Bottom} />
      <Handle id="left-t" type="target" position={Position.Left} />
      <Handle id="top" type="source" position={Position.Top} />
      <Handle id="right" type="source" position={Position.Right} />
      <Handle id="bottom" type="source" position={Position.Bottom} />
      <Handle id="left" type="source" position={Position.Left} />
      <div
        className={`editable-node shape-${shape}${shape === 'text' ? ` align-${textAlign}` : ''}${selected ? ' selected' : ''}`}
        style={{
          ...(data.fontSize ? { fontSize: `${data.fontSize}px` } : {}),
          ...(color ? { background: color } : {}),
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <textarea
            ref={inputRef}
            className={`editable-node__input editable-node__input--multiline${isText ? '' : ' editable-node__input--centered'}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            rows={Math.max(1, draft.split('\n').length)}
          />
        ) : (
          <span className="editable-node__label">{String(data.label ?? '')}</span>
        )}
      </div>
    </>
  );
}
