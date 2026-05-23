import { useState, useRef, useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Handle, Position, NodeResizer, type NodeProps, useReactFlow } from '@xyflow/react';
import { useMindMapStore, useUIStore } from '../state/stores.js';
import { TextEditingToolbar } from './TextEditingToolbar.js';
import type { NodeShape } from '../types/mindmap.js';

/** Escape plain text for safe insertion as innerHTML. */
function htmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function EditableNode({ id, data, selected }: NodeProps): JSX.Element {
  const renameNode = useMindMapStore((s) => s.renameNode);
  const resizeNode = useMindMapStore((s) => s.resizeNode);
  const setEditingNodeId = useUIStore((s) => s.setEditingNodeId);
  const { setNodes } = useReactFlow();
  const shape: NodeShape = (data.shape as NodeShape | undefined) ?? 'rectangle';
  const textAlign = (data.textAlign as 'left' | 'center' | 'right' | undefined) ?? 'center';
  const color = data.color as string | undefined;
  const borderColor = data.borderColor as string | undefined;
  const textColor = data.textColor as string | undefined;
  const fontFamily = data.fontFamily as string | undefined;
  const fontWeight = data.fontWeight as 'normal' | 'bold' | undefined;
  const fontStyle = data.fontStyle as 'normal' | 'italic' | undefined;
  const [editing, setEditing] = useState(false);
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const isText = shape === 'text';

  const commitEdit = useCallback(() => {
    const el = contentEditableRef.current;
    if (el) {
      const html = el.innerHTML;
      const rawText = el.textContent ?? '';
      const trimmed = isText ? rawText.replace(/\s+$/, '') : rawText.trim();
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
  }, [id, renameNode, setNodes, isText, setEditingNodeId]);

  // Blur handler: don't commit if focus moved into the text-editing toolbar.
  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLDivElement>) => {
      const rt = e.relatedTarget as HTMLElement | null;
      if (rt?.closest('.text-editing-toolbar')) {
        return;
      }
      commitEdit();
    },
    [commitEdit],
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(true);
      setEditingNodeId(id);
      // Set innerHTML after React renders the contentEditable div.
      requestAnimationFrame(() => {
        const el = contentEditableRef.current;
        if (!el) return;
        el.innerHTML =
          (data.richLabel as string | undefined) ?? htmlEscape(String(data.label ?? ''));
        el.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        sel?.removeAllRanges();
        sel?.addRange(range);
      });
    },
    [data.label, data.richLabel, id, setEditingNodeId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter') {
        if (isText && e.shiftKey) {
          // Insert a <br> line break in the contentEditable.
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
    [commitEdit, isText, setEditingNodeId],
  );

  // Ensure global editing flag is cleared if this node unmounts mid-edit.
  useEffect(() => {
    return () => {
      if (editing) setEditingNodeId(null);
    };
  }, []);

  // Minimum dimensions per shape
  const minWidth =
    shape === 'circle'
      ? 24
      : shape === 'ellipse'
        ? 30
        : shape === 'diamond'
          ? 48
          : shape === 'text'
            ? 20
            : 40;
  const minHeight =
    shape === 'circle'
      ? 24
      : shape === 'ellipse'
        ? 20
        : shape === 'diamond'
          ? 36
          : shape === 'text'
            ? 16
            : 20;

  return (
    <>
      {editing && (
        <TextEditingToolbar
          nodeId={id}
          fontSize={data.fontSize as number | undefined}
          fontFamily={fontFamily}
          containerRef={contentEditableRef}
          onInteractionDone={() => contentEditableRef.current?.focus()}
        />
      )}
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
        className={`editable-node shape-${shape}${shape === 'text' ? ` align-${textAlign}` : ''}${selected ? ' selected' : ''}${editing ? ' nodrag' : ''}`}
        style={{
          ...(data.fontSize ? { fontSize: `${data.fontSize}px` } : {}),
          ...(fontFamily ? { fontFamily } : {}),
          ...(fontWeight ? { fontWeight } : {}),
          ...(fontStyle ? { fontStyle } : {}),
          ...(borderColor && shape !== 'text'
            ? { ['--node-border-color' as string]: borderColor, borderColor }
            : {}),
          ...(shape === 'text'
            ? { ...(textColor ? { color: textColor } : {}) }
            : {
                ...(color ? { background: color } : {}),
                ...(textColor ? { color: textColor } : {}),
              }),
        }}
        onDoubleClick={handleDoubleClick}
      >
        {editing ? (
          <div
            ref={contentEditableRef}
            className={`editable-node__editor${isText ? '' : ' editable-node__editor--centered'}`}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
          />
        ) : (data.richLabel as string | undefined) ? (
          <span
            className="editable-node__label"
            dangerouslySetInnerHTML={{ __html: data.richLabel as string }}
          />
        ) : (
          <span className="editable-node__label">{String(data.label ?? '')}</span>
        )}
      </div>
    </>
  );
}
