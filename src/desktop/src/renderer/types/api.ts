import type { IpcRendererEvent } from 'electron';

/** Mirrors the AutosavePayload defined in main/ipc.ts. */
export interface AutosavePayload {
  originalPath: string | undefined;
  content: string;
  savedAt: string;
}

/** Shape of the API exposed via contextBridge as `window.awapi`. */
export interface AwapiApi {
  // Dialogs
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;
  showMessageBox: (options: Electron.MessageBoxOptions) => Promise<Electron.MessageBoxReturnValue>;

  // File I/O
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;

  // App info
  getVersion: () => Promise<string>;

  // Window / quit lifecycle
  setDirty: (dirty: boolean) => Promise<void>;
  setFilePath: (filePath: string | undefined) => Promise<void>;
  setHasMap: (hasMap: boolean) => Promise<void>;
  closeWindow: () => Promise<void>;

  // Recent files
  recentsGet: () => Promise<string[]>;
  recentsAdd: (filePath: string) => Promise<string[]>;
  recentsClear: () => Promise<void>;

  // Auto-save
  autosaveWrite: (payload: AutosavePayload) => Promise<void>;
  autosaveRead: () => Promise<AutosavePayload | null>;
  autosaveClear: () => Promise<void>;

  // Menu events — return an unsubscribe function
  onMenuNewMap: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuOpen: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuSave: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuSaveAs: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuOpenRecent: (handler: (event: IpcRendererEvent, path: string) => void) => () => void;
  onMenuSaveAndClose: (handler: (event: IpcRendererEvent) => void) => () => void;
}

declare global {
  interface Window {
    awapi: AwapiApi;
  }
}
