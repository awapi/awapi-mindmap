import { useRef, useState, useEffect } from 'react';
import type { JSX } from 'react';
import { createPortal } from 'react-dom';

/**
 * Theme colors: 10 hue families, 5 shades each (light → dark).
 * Stored column-major so we render row by row for a correct grid layout.
 */
const THEME_COLORS: string[][] = [
  ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#808080'], // White → Gray
  ['#1a1a1a', '#333333', '#595959', '#737373', '#999999'], // Black → Med-gray
  ['#dce6f1', '#9dc3e6', '#2e75b6', '#1f4e79', '#0d2741'], // Sky blue
  ['#e2efda', '#a9d18e', '#548235', '#375623', '#1c2d12'], // Green
  ['#fce4d6', '#f4b183', '#ed7d31', '#a35a0e', '#5a3108'], // Orange
  ['#ffd7d7', '#ff9090', '#e04040', '#c00000', '#800000'], // Red
  ['#fff2cc', '#ffe699', '#ffd966', '#ffc000', '#bf8f00'], // Yellow / Gold
  ['#e8d5f5', '#c094e3', '#8030b0', '#5a1080', '#2d0840'], // Purple
  ['#d0f5e0', '#86e3aa', '#00b050', '#006b30', '#003818'], // Emerald
  ['#cce4ff', '#66b2ff', '#0070cc', '#004c8c', '#00284d'], // Cobalt blue
];

const STANDARD_COLORS: string[] = [
  '#c00000',
  '#ff0000',
  '#ffc000',
  '#ffff00',
  '#92d050',
  '#00b050',
  '#00b0f0',
  '#0070c0',
  '#002060',
  '#7030a0',
];

interface ColorPickerProps {
  /** Currently active color as a CSS hex string, or `undefined` for "default / none". */
  value?: string;
  onChange: (color: string | undefined) => void;
  /**
   * Short text label (e.g. `'A'` for text colour).
   * When provided the button shows the label above a coloured underline bar.
   * When omitted the button shows a plain coloured circle swatch.
   */
  label?: string;
  title?: string;
  /** When `true` (default) a "No Color" option is shown at the bottom of the panel. */
  allowReset?: boolean;
  /** Value emitted by "No Color". Defaults to `undefined`; shape fills use `transparent`. */
  noColorValue?: string;
}

export function ColorPicker({
  value,
  onChange,
  label,
  title,
  allowReset = true,
  noColorValue,
}: ColorPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  // Close panel when clicking outside both the trigger button and the panel.
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', handler, true);
    return () => document.removeEventListener('pointerdown', handler, true);
  }, [open]);

  const openPanel = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(true);
  };

  const toggle = () => (open ? setOpen(false) : openPanel());

  /** Apply a colour and close the panel. */
  const pick = (color: string | undefined) => {
    onChange(color);
    setOpen(false);
  };

  /** Open the OS-native colour picker without closing the panel. */
  const openNativePicker = () => {
    if (colorInputRef.current) {
      colorInputRef.current.value = isNone ? '#ffffff' : value!;
      colorInputRef.current.click();
    }
  };

  const displayColor = value ?? 'transparent';
  const isNone = !value || value === noColorValue;

  const panel = (
    <div
      ref={panelRef}
      className="color-picker__panel"
      style={{ top: panelPos.top, left: panelPos.left }}
      // Prevent focus loss from contenteditable when interacting with the panel.
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="color-picker__section-label">Theme Colors</div>
      {/* Render row-by-row so each column is a hue family */}
      <div className="color-picker__theme-grid">
        {Array.from({ length: 5 }, (_, row) =>
          THEME_COLORS.map((col, ci) => {
            const color = col[row]!;
            return (
              <button
                key={`${ci}-${row}`}
                type="button"
                className={`color-picker__swatch${value != null && value.toLowerCase() === color.toLowerCase() ? ' is-selected' : ''}`}
                style={{ background: color }}
                title={color}
                onClick={() => pick(color)}
              />
            );
          }),
        )}
      </div>

      <div className="color-picker__cp-separator" />

      <div className="color-picker__section-label">Standard Colors</div>
      <div className="color-picker__standard-row">
        {STANDARD_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`color-picker__swatch${value != null && value.toLowerCase() === color.toLowerCase() ? ' is-selected' : ''}`}
            style={{ background: color }}
            title={color}
            onClick={() => pick(color)}
          />
        ))}
      </div>

      <div className="color-picker__cp-separator" />

      {/* "More Colors…" opens the OS-native colour dialog. */}
      <button type="button" className="color-picker__action-btn" onClick={openNativePicker}>
        <span
          className="color-picker__action-preview"
          style={{ background: value ?? '#ffffff', border: '1px solid var(--border)' }}
        />
        More Colors…
      </button>

      {allowReset && (
        <button
          type="button"
          className="color-picker__action-btn"
          onClick={() => pick(noColorValue)}
        >
          <span className="color-picker__action-preview color-picker__action-preview--none">⊘</span>
          No Color
        </button>
      )}

      {/* Hidden native <input type="color"> — triggered programmatically above. */}
      <input
        ref={colorInputRef}
        type="color"
        className="color-picker__native-input"
        defaultValue={isNone ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );

  return (
    <div className="color-picker">
      <button
        ref={btnRef}
        type="button"
        className={`color-picker__btn${open ? ' is-open' : ''}`}
        title={title}
        // Prevent stealing focus from contenteditable (same pattern as other toolbar buttons).
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
      >
        {label ? (
          /* Text-colour mode: label text + coloured underline bar */
          <span className="color-picker__label-wrap" aria-hidden="true">
            <span className="color-picker__label-text">{label}</span>
            <span
              className="color-picker__label-bar"
              style={{
                background: isNone ? 'transparent' : displayColor,
                borderStyle: isNone ? 'dashed' : 'solid',
              }}
            />
          </span>
        ) : (
          /* Fill-colour mode: plain coloured circle */
          <span
            className="color-picker__circle"
            style={{
              background: displayColor,
              borderStyle: isNone ? 'dashed' : 'solid',
            }}
          />
        )}
        <span className="color-picker__arrow" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && createPortal(panel, document.body)}
    </div>
  );
}
