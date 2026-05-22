import { useState, useEffect, type RefObject } from 'react';
import type { JSX } from 'react';
import { NodeToolbar, Position, useReactFlow } from '@xyflow/react';
import { useMindMapStore } from '../state/stores.js';

interface TextEditingToolbarProps {
  nodeId: string;
  fontSize?: number;
  fontFamily?: string;
  /** Ref to the contentEditable div. Font-size span-injection and font-family
   *  execCommand use this to check whether there is an active text selection
   *  inside the editor before falling back to node-level changes. */
  containerRef?: RefObject<HTMLDivElement>;
  /** Called after the user interacts with a focusable control (input/select) so
   *  the parent can re-focus the contentEditable div. */
  onInteractionDone?: () => void;
}

const TEXT_COLOUR_OPTIONS: Array<{ color: string; title: string }> = [
  { color: '#ffffff', title: 'White' },
  { color: '#e0e0e0', title: 'Light gray' },
  { color: '#9090a0', title: 'Gray' },
  { color: '#1a1a2e', title: 'Dark' },
  { color: '#e94560', title: 'Red' },
  { color: '#f5a623', title: 'Orange' },
  { color: '#f8e71c', title: 'Yellow' },
  { color: '#7ed321', title: 'Green' },
  { color: '#4a90e2', title: 'Blue' },
  { color: '#9b59b6', title: 'Purple' },
  { color: '#1abc9c', title: 'Teal' },
];

const FONT_FAMILY_OPTIONS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: 'Default' },
  { value: 'sans-serif', label: 'Sans-Serif' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Mono' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Courier New', monospace", label: 'Courier' },
];

const FONT_MIN = 6;
const FONT_MAX = 96;
const FONT_DEFAULT = 14;
const FONT_STEP = 2;

const clampFont = (n: number) => Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n)));

export function TextEditingToolbar({
  nodeId,
  fontSize,
  fontFamily,
  containerRef,
  onInteractionDone,
}: TextEditingToolbarProps): JSX.Element {
  const setNodeFontSize = useMindMapStore((s) => s.setNodeFontSize);
  const setNodeFontFamily = useMindMapStore((s) => s.setNodeFontFamily);
  const { setNodes } = useReactFlow();

  const effectiveFont = fontSize ?? FONT_DEFAULT;
  const [fontDraft, setFontDraft] = useState<string>(
    fontSize == null ? String(FONT_DEFAULT) : String(fontSize),
  );
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);

  useEffect(() => {
    setFontDraft(fontSize == null ? String(FONT_DEFAULT) : String(fontSize));
  }, [fontSize]);

  // Track the bold/italic state of the current text selection.
  useEffect(() => {
    const update = () => {
      try {
        setIsBold(document.queryCommandState('bold'));
        setIsItalic(document.queryCommandState('italic'));
      } catch {
        // queryCommandState can throw in edge cases; ignore.
      }
    };
    document.addEventListener('selectionchange', update);
    return () => document.removeEventListener('selectionchange', update);
  }, []);

  const applyFontSize = (size: number) => {
    const next = clampFont(size);
    const selection = window.getSelection();
    const container = containerRef?.current;
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hasSelection =
      range != null &&
      !range.collapsed &&
      container != null &&
      container.contains(range.commonAncestorContainer);

    if (hasSelection && range != null) {
      // Wrap selected characters in a <span> with the requested font size.
      const span = document.createElement('span');
      span.style.fontSize = `${next}px`;
      try {
        range.surroundContents(span);
      } catch {
        // Selection crosses element boundaries — extract then re-insert.
        const frag = range.extractContents();
        span.appendChild(frag);
        range.insertNode(span);
      }
      selection!.removeAllRanges();
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection!.addRange(newRange);
    } else {
      // No selection — apply to the whole node.
      setNodeFontSize([nodeId], next);
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, fontSize: next } } : n)),
      );
    }
    return next;
  };

  const commitFontDraft = () => {
    const parsed = parseInt(fontDraft, 10);
    if (!Number.isFinite(parsed)) {
      setFontDraft(String(effectiveFont));
      onInteractionDone?.();
      return;
    }
    const next = applyFontSize(parsed);
    setFontDraft(String(next));
    onInteractionDone?.();
  };

  const applyFontFamily = (value: string | undefined) => {
    const selection = window.getSelection();
    const container = containerRef?.current;
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const hasSelection =
      range != null &&
      !range.collapsed &&
      container != null &&
      container.contains(range.commonAncestorContainer);

    if (hasSelection && value) {
      document.execCommand('fontName', false, value);
    } else {
      setNodeFontFamily([nodeId], value);
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, fontFamily: value } } : n)),
      );
    }
    onInteractionDone?.();
  };

  const applyTextColor = (color: string | undefined) => {
    if (color) {
      document.execCommand('foreColor', false, color);
    } else {
      // Reset button: clear all inline formatting (colour, inline font size, etc.).
      document.execCommand('removeFormat');
    }
  };

  const toggleBold = () => {
    document.execCommand('bold');
    setIsBold(document.queryCommandState('bold'));
  };

  const toggleItalic = () => {
    document.execCommand('italic');
    setIsItalic(document.queryCommandState('italic'));
  };

  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} align="start" offset={8}>
      <div
        className="node-toolbar text-editing-toolbar nodrag nopan"
        onDoubleClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          // Prevent focus from leaving the textarea when clicking buttons.
          // The <input> and <select> stop propagation themselves so they can
          // still receive focus when needed.
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Bold / Italic */}
        <div className="node-toolbar__group" role="group" aria-label="Style">
          <button
            type="button"
            className={`node-toolbar__btn node-toolbar__style-btn${isBold ? ' is-active' : ''}`}
            title="Bold"
            onClick={toggleBold}
          >
            <b>B</b>
          </button>
          <button
            type="button"
            className={`node-toolbar__btn node-toolbar__style-btn${isItalic ? ' is-active' : ''}`}
            title="Italic"
            onClick={toggleItalic}
          >
            <i>I</i>
          </button>
        </div>

        <div className="node-toolbar__divider" />

        {/* Font size */}
        <div className="node-toolbar__group" role="group" aria-label="Font size">
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--small"
            title="Decrease font size"
            onClick={() => {
              const next = applyFontSize(effectiveFont - FONT_STEP);
              setFontDraft(String(next));
            }}
            disabled={effectiveFont <= FONT_MIN}
          >
            a
          </button>
          <input
            type="number"
            className="node-toolbar__font-input"
            min={FONT_MIN}
            max={FONT_MAX}
            value={fontDraft}
            title="Font size (px)"
            aria-label="Font size in pixels"
            onChange={(e) => setFontDraft(e.target.value)}
            onBlur={commitFontDraft}
            // Allow this input to receive focus (override container's preventDefault)
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitFontDraft();
                (e.target as HTMLInputElement).blur();
              } else if (e.key === 'Escape') {
                setFontDraft(String(effectiveFont));
                (e.target as HTMLInputElement).blur();
                onInteractionDone?.();
              }
              e.stopPropagation();
            }}
          />
          <button
            type="button"
            className="node-toolbar__btn node-toolbar__font node-toolbar__font--large"
            title="Increase font size"
            onClick={() => {
              const next = applyFontSize(effectiveFont + FONT_STEP);
              setFontDraft(String(next));
            }}
            disabled={effectiveFont >= FONT_MAX}
          >
            A
          </button>
        </div>

        <div className="node-toolbar__divider" />

        {/* Font family */}
        <div className="node-toolbar__group" role="group" aria-label="Font family">
          <select
            className="node-toolbar__font-select"
            value={fontFamily ?? ''}
            title="Font family"
            aria-label="Font family"
            onChange={(e) => {
              const val = e.target.value;
              applyFontFamily(val === '' ? undefined : val);
            }}
            // Allow focus so the native dropdown opens; re-focus textarea via
            // applyFontFamily → onInteractionDone after the selection is made.
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {FONT_FAMILY_OPTIONS.map((opt) => (
              <option key={opt.label} value={opt.value ?? ''}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="node-toolbar__divider" />

        {/* Text colour */}
        <div className="node-toolbar__group" role="group" aria-label="Text colour">
          <span className="node-toolbar__label" aria-hidden="true">
            A
          </span>
          {TEXT_COLOUR_OPTIONS.map((opt) => (
            <button
              key={opt.color}
              type="button"
              className="node-toolbar__swatch"
              style={{ background: opt.color }}
              title={opt.title}
              onClick={() => applyTextColor(opt.color)}
            />
          ))}
          <button
            type="button"
            className="node-toolbar__swatch node-toolbar__swatch--reset"
            title="Clear inline formatting (colour, size, font)"
            onClick={() => applyTextColor(undefined)}
          >
            ⊘
          </button>
        </div>
      </div>
    </NodeToolbar>
  );
}
