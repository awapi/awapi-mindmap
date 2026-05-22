import { useEffect, useCallback, useRef } from 'react';
import type { JSX } from 'react';
import { Canvas } from './components/Canvas.js';
import { useMindMapStore, useThemeStore } from './state/stores.js';
import type { AwmmFile, MindMap } from './types/mindmap.js';
import { AWMM_VERSION } from './types/mindmap.js';
import { nanoid } from './utils/nanoid.js';

/** How often to write the autosave file when there are unsaved changes. */
const AUTOSAVE_INTERVAL_MS = 60_000;

/**
 * Prompt the user about unsaved changes before a destructive action.
 * Returns true when the caller should proceed (Save succeeded or Don't Save),
 * false when the user cancelled.
 */
async function confirmDiscardOrSave(
  mindMap: MindMap,
  doSave: () => Promise<boolean>,
): Promise<boolean> {
  const result = await window.awapi.showMessageBox({
    type: 'warning',
    buttons: ['Save', "Don't Save", 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved changes',
    message: `Save changes to "${mindMap.title}"?`,
    detail: 'Your changes will be lost if you don\'t save them.',
  });
  if (result.response === 0) return doSave();
  if (result.response === 1) return true;
  return false;
}

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

  // Keep refs to current values so async/event handlers always read fresh state.
  const mindMapRef = useRef(mindMap);
  const filePathRef = useRef(filePath);
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    mindMapRef.current = mindMap;
  }, [mindMap]);
  useEffect(() => {
    filePathRef.current = filePath;
  }, [filePath]);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Apply data-theme on the root element.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Mirror dirty / filePath / hasMap state to main so it can guard window
  // close and toggle menu items.
  useEffect(() => {
    void window.awapi.setDirty(isDirty);
  }, [isDirty]);
  useEffect(() => {
    void window.awapi.setFilePath(filePath);
  }, [filePath]);
  useEffect(() => {
    void window.awapi.setHasMap(mindMap !== null);
  }, [mindMap]);

  // Global undo / redo shortcut (Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const serialise = useCallback((map: MindMap): string => {
    const file: AwmmFile = { version: AWMM_VERSION, mindMap: map };
    return JSON.stringify(file, null, 2);
  }, []);

  /** Writes the given map to `targetPath`. Returns true on success. */
  const doSave = useCallback(
    async (targetPath: string, map: MindMap): Promise<boolean> => {
      try {
        await window.awapi.writeFile(targetPath, serialise(map));
        markSaved(targetPath);
        await window.awapi.recentsAdd(targetPath);
        await window.awapi.autosaveClear();
        return true;
      } catch (err) {
        console.error('Failed to save file:', err);
        return false;
      }
    },
    [markSaved, serialise],
  );

  /** Save current map. Returns false if user cancelled or no map. */
  const handleSave = useCallback(async (): Promise<boolean> => {
    const map = mindMapRef.current;
    if (!map) return false;
    const path = filePathRef.current;
    if (path) return doSave(path, map);
    const result = await window.awapi.showSaveDialog({
      title: 'Save Mind Map',
      defaultPath: `${map.title ?? 'untitled'}.awmm`,
      filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
    });
    if (result.canceled || !result.filePath) return false;
    return doSave(result.filePath, map);
  }, [doSave]);

  const handleSaveAs = useCallback(async (): Promise<boolean> => {
    const map = mindMapRef.current;
    if (!map) return false;
    const result = await window.awapi.showSaveDialog({
      title: 'Save Mind Map As',
      defaultPath: `${map.title ?? 'untitled'}.awmm`,
      filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
    });
    if (result.canceled || !result.filePath) return false;
    return doSave(result.filePath, map);
  }, [doSave]);

  const openPath = useCallback(
    async (path: string) => {
      try {
        const raw = await window.awapi.readFile(path);
        const file = JSON.parse(raw) as AwmmFile;
        setMindMap(file.mindMap, path);
        await window.awapi.recentsAdd(path);
        await window.awapi.autosaveClear();
      } catch (err) {
        console.error('Failed to open file:', err);
        await window.awapi.showMessageBox({
          type: 'error',
          title: 'Open failed',
          message: 'Could not open file',
          detail: String(err),
        });
      }
    },
    [setMindMap],
  );

  const handleOpen = useCallback(async () => {
    if (isDirtyRef.current && mindMapRef.current) {
      const ok = await confirmDiscardOrSave(mindMapRef.current, handleSave);
      if (!ok) return;
    }
    const result = await window.awapi.showOpenDialog({
      title: 'Open Mind Map',
      filters: [{ name: 'AwapiMindmap', extensions: ['awmm'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return;
    const path = result.filePaths[0];
    if (!path) return;
    await openPath(path);
  }, [handleSave, openPath]);

  const handleNew = useCallback(async () => {
    if (isDirtyRef.current && mindMapRef.current) {
      const ok = await confirmDiscardOrSave(mindMapRef.current, handleSave);
      if (!ok) return;
    }
    newMap();
    await window.awapi.autosaveClear();
  }, [handleSave, newMap]);

  // Save then close (requested by main when user picked "Save" in close prompt).
  const handleSaveAndClose = useCallback(async () => {
    const saved = await handleSave();
    if (saved) await window.awapi.closeWindow();
  }, [handleSave]);

  // ---- Wire menu events ---------------------------------------------------

  useEffect(() => {
    const offNew = window.awapi.onMenuNewMap(() => void handleNew());
    const offOpen = window.awapi.onMenuOpen(() => void handleOpen());
    const offSave = window.awapi.onMenuSave(() => void handleSave());
    const offSaveAs = window.awapi.onMenuSaveAs(() => void handleSaveAs());
    const offRecent = window.awapi.onMenuOpenRecent((_e, path) => {
      void (async () => {
        if (isDirtyRef.current && mindMapRef.current) {
          const ok = await confirmDiscardOrSave(mindMapRef.current, handleSave);
          if (!ok) return;
        }
        await openPath(path);
      })();
    });
    const offSaveAndClose = window.awapi.onMenuSaveAndClose(() => void handleSaveAndClose());
    return () => {
      offNew();
      offOpen();
      offSave();
      offSaveAs();
      offRecent();
      offSaveAndClose();
    };
  }, [handleNew, handleOpen, handleSave, handleSaveAs, handleSaveAndClose, openPath]);

  // ---- Auto-save timer ----------------------------------------------------

  useEffect(() => {
    const interval = setInterval(() => {
      const map = mindMapRef.current;
      if (!map || !isDirtyRef.current) return;
      const payload = {
        originalPath: filePathRef.current,
        content: serialise(map),
        savedAt: new Date().toISOString(),
      };
      void window.awapi.autosaveWrite(payload);
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [serialise]);

  // ---- Crash recovery / initial map on launch ---------------------------

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const payload = await window.awapi.autosaveRead();
      if (cancelled) return;
      if (!payload) {
        // No prior session to recover — start with a fresh empty map so the
        // user can begin working immediately.
        newMap();
        return;
      }
      const when = new Date(payload.savedAt).toLocaleString();
      const source = payload.originalPath ?? 'an unsaved map';
      const result = await window.awapi.showMessageBox({
        type: 'question',
        buttons: ['Recover', 'Discard'],
        defaultId: 0,
        cancelId: 1,
        title: 'Recover unsaved changes?',
        message: 'AwapiMindmap found auto-saved changes from a previous session.',
        detail: `Source: ${source}\nSaved at: ${when}`,
      });
      if (cancelled) return;
      if (result.response === 0) {
        try {
          const file = JSON.parse(payload.content) as AwmmFile;
          setMindMap(file.mindMap, payload.originalPath);
        } catch (err) {
          console.error('Failed to parse autosave payload:', err);
          await window.awapi.autosaveClear();
          newMap();
        }
      } else {
        await window.awapi.autosaveClear();
        newMap();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setMindMap, newMap]);

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
