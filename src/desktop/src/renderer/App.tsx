import { useEffect, useCallback } from 'react';
import type { JSX } from 'react';
import { Canvas } from './components/Canvas.js';
import { useMindMapStore, useThemeStore } from './state/stores.js';
import type { AwmmFile, MindMap } from './types/mindmap.js';
import { AWMM_VERSION } from './types/mindmap.js';
import { nanoid } from './utils/nanoid.js';

export function App(): JSX.Element {
  const theme = useThemeStore((s) => s.theme);
  const mindMap = useMindMapStore((s) => s.mindMap);
  const filePath = useMindMapStore((s) => s.filePath);
  const isDirty = useMindMapStore((s) => s.isDirty);
  const newMap = useMindMapStore((s) => s.newMap);
  const setMindMap = useMindMapStore((s) => s.setMindMap);
  const markSaved = useMindMapStore((s) => s.markSaved);
  const undo = useMindMapStore((s) => s.undo);
  const redo = useMindMapStore((s) => s.redo);

  // Apply data-theme on the root element.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Global undo / redo shortcut (Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip when focus is inside an input or contenteditable
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (isMeta && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  // ---- File helpers -------------------------------------------------------

  const handleNew = useCallback(() => {
    if (isDirty) {
      // TODO: prompt to save unsaved changes before clearing.
    }
    newMap();
  }, [isDirty, newMap]);

  const handleOpen = useCallback(async () => {
    const result = await window.awapi.showOpenDialog({
      title: 'Open Mind Map',
      filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const path = result.filePaths[0];
    if (!path) return;
    try {
      const raw = await window.awapi.readFile(path);
      const file = JSON.parse(raw) as AwmmFile;
      setMindMap(file.mindMap, path);
    } catch (err) {
      console.error('Failed to open file:', err);
    }
  }, [setMindMap]);

  const doSave = useCallback(
    async (targetPath: string, map: MindMap) => {
      const file: AwmmFile = { version: AWMM_VERSION, mindMap: map };
      await window.awapi.writeFile(targetPath, JSON.stringify(file, null, 2));
      markSaved(targetPath);
    },
    [markSaved],
  );

  const handleSave = useCallback(async () => {
    if (!mindMap) return;
    if (filePath) {
      await doSave(filePath, mindMap);
    } else {
      const result = await window.awapi.showSaveDialog({
        title: 'Save Mind Map',
        defaultPath: `${mindMap.title ?? 'untitled'}.awmm`,
        filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
      });
      if (!result.canceled && result.filePath) {
        await doSave(result.filePath, mindMap);
      }
    }
  }, [mindMap, filePath, doSave]);

  const handleSaveAs = useCallback(async () => {
    if (!mindMap) return;
    const result = await window.awapi.showSaveDialog({
      title: 'Save Mind Map As',
      defaultPath: `${mindMap.title ?? 'untitled'}.awmm`,
      filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
    });
    if (!result.canceled && result.filePath) {
      await doSave(result.filePath, mindMap);
    }
  }, [mindMap, doSave]);

  // ---- Wire menu events ---------------------------------------------------

  useEffect(() => {
    const offNew = window.awapi.onMenuNewMap(handleNew);
    const offOpen = window.awapi.onMenuOpen(() => void handleOpen());
    const offSave = window.awapi.onMenuSave(() => void handleSave());
    const offSaveAs = window.awapi.onMenuSaveAs(() => void handleSaveAs());
    return () => {
      offNew();
      offOpen();
      offSave();
      offSaveAs();
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs]);

  // ---- Title bar ----------------------------------------------------------

  const title = mindMap
    ? `${isDirty ? '● ' : ''}${mindMap.title}${filePath ? '' : ' (unsaved)'} — AwapiMindmap`
    : 'AwapiMindmap';
  document.title = title;

  // Suppress unused variable warning for nanoid (used by stores, not here).
  void nanoid;

  return (
    <div className="app" data-theme={theme}>
      <Canvas />
    </div>
  );
}
