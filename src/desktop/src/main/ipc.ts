/** Named IPC channels shared between main and preload. */
export const IpcChannel = {
  // File dialogs
  ShowOpenDialog: 'dialog:showOpen',
  ShowSaveDialog: 'dialog:showSave',
  ShowMessageBox: 'dialog:showMessageBox',

  // File I/O
  ReadFile: 'fs:readFile',
  WriteFile: 'fs:writeFile',

  // App info
  GetVersion: 'app:getVersion',

  // Renderer → main: window/quit lifecycle
  SetDirty: 'app:setDirty',
  SetFilePath: 'app:setFilePath',
  SetHasMap: 'app:setHasMap',
  CloseWindow: 'app:closeWindow',

  // Recent files
  RecentsGet: 'recents:get',
  RecentsAdd: 'recents:add',
  RecentsClear: 'recents:clear',

  // Auto-save
  AutosaveWrite: 'autosave:write',
  AutosaveRead: 'autosave:read',
  AutosaveClear: 'autosave:clear',

  // Updater
  UpdaterCheck: 'updater:check',

  // Binary file write (for PNG export)
  WriteBinaryFile: 'fs:writeBinaryFile',

  // Canvas screenshot capture (for PNG/SVG export)
  CaptureCanvas: 'canvas:capture',

  // Menu actions (main → renderer)
  MenuNewMap: 'menu:newMap',
  MenuOpen: 'menu:open',
  MenuSave: 'menu:save',
  MenuSaveAs: 'menu:saveAs',
  MenuOpenRecent: 'menu:openRecent',
  MenuSaveAndClose: 'menu:saveAndClose',
  MenuSelectAll: 'menu:selectAll',

  // Export menu events (main → renderer)
  MenuExportPng: 'menu:exportPng',
  MenuExportSvg: 'menu:exportSvg',
  MenuExportText: 'menu:exportText',
  MenuExportMarkdown: 'menu:exportMarkdown',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Payload written to the autosave file in userData. */
export interface AutosavePayload {
  /** Original on-disk path of the map being edited, if any. */
  originalPath: string | undefined;
  /** Serialised .awmm file contents (already JSON-stringified). */
  content: string;
  /** ISO timestamp of when this autosave was written. */
  savedAt: string;
}
