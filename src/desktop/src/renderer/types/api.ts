import type { IpcRendererEvent } from 'electron';

/** Shape of the API exposed via contextBridge as `window.awapi`. */
export interface AwapiApi {
  // Dialogs
  showOpenDialog: (options: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>;
  showSaveDialog: (options: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>;

  // File I/O
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, content: string) => Promise<void>;

  // App info
  getVersion: () => Promise<string>;

  // Menu events — return an unsubscribe function
  onMenuNewMap: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuOpen: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuSave: (handler: (event: IpcRendererEvent) => void) => () => void;
  onMenuSaveAs: (handler: (event: IpcRendererEvent) => void) => () => void;
}

declare global {
  interface Window {
    awapi: AwapiApi;
  }
}
