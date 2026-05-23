import { useState, useRef, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { useMindMapStore, useUIStore } from '../state/stores.js';
import { TextEditingToolbar } from './TextEditingToolbar.js';

function htmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function StickyNote({ id, data, selected }: NodeProps): JSX.Element {
  const renameNode = useMindMapStore((s) => s.renameNode);
  const resizeNode = useMindMapStore((s) => s.resizeNode);
  const setEditingNodeId = useUIStore((s) => s.setEditingNodeId);
  const { setNodes } = useReactFlow();

  const [editing, setEditing] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement>(null);

  const commitEdit = useCallback(() => {
    const el = contentEditableRef.current;
    if (el) {
      const html = el.innerHTML;
      const trimmed = (el.textContent ?? '').replace(/\s+$/, '');
      if (trimmed) {
        renameNode(id, trimmed, html);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, label: trimmed, richLabel: html } } : n,
          ),
        );
      }
    }
    setEditing(false);
    setEditingNodeId(null);
  }, [id, renameNode, setEditingNodeId, setNodes]);

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const relatedTarget = e.relatedTarget as HTMLElement | null;
      if (relatedTarget?.closest('.text-editing-toolbar')) return;
      commitEdit();
    },
    [commitEdit],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(true);
      setEditingNodeId(id);
      requestAnimationFrame(() => {
        const el = contentEditableRef.current;
        if (!el) return;
        el.innerHTML =
          (data.richLabel as string | undefined) ?? htmlEscape(String(data.label ?? ''));
        el.focus();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        selection?.removeAllRanges();
        selection?.addRange(range);
      });
    },
    [data.label, data.richLabel, id, setEditingNodeId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        if (e.shiftKey) {
          e.preventDefault();
          document.execCommand('insertLineBreak');
        } else {
          e.preventDefault();
          commitEdit();
        }
      }
      if (e.key === 'Escape') {
        setEditing(false);
        setEditingNodeId(null);
      }
      e.stopPropagation();
    },
    [commitEdit, setEditingNodeId],
  );

  useEffect(() => {
    return () => {
      if (editing) setEditingNodeId(null);
    };
  }, [editing, setEditingNodeId]);

  const handleResizeEnd = useCallback(
    (_e: unknown, params: { width: number; height: number; x: number; y: number }) => {
      resizeNode(id, params.width, params.height, { x: params.x, y: params.y });
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id
            ? { ...n, width: params.width, height: params.height, position: { x: params.x, y: params.y } }
            : n,
        ),
      );
    },
    [id, resizeNode, setNodes],
  );

  const bgColor = (data.color as string | undefined) ?? '#fef3c7';
  const textColor = data.textColor as string | undefined;
  const fontSize = data.fontSize as number | undefined;

  return (
    <>
      {editing && (
        <TextEditingToolbar
          nodeId={id}
          fontSize={fontSize}
          containerRef={contentEditableRef}
          onInteractionDone={() => contentEditableRef.current?.focus()}
        />
      )}
      <NodeResizer
        isVisible={selected}
        minWidth={60}
        minHeight={40}
        onResizeEnd={handleResizeEnd}
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
        className={`sticky-note${selected ? ' selected' : ''}${editing ? ' nodrag' : ''}`}
        style={{
          background: bgColor,
          ...(textColor ? { color: textColor } : {}),
          ...(fontSize != null ? { fontSize } : {}),
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <div
            ref={contentEditableRef}
            className="sticky-note__editor"
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (data.richLabel as string | undefined) ? (
          <span
            className="sticky-note__label"
            dangerouslySetInnerHTML={{ __html: data.richLabel as string }}
          />
        ) : (
          <span className="sticky-note__label">{String(data.label || 'Double-click to edit…')}</span>
        )}
      </div>
    </>
  );
}
