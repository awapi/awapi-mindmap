/** Named IPC channels shared between main and preload. */
export const IpcChannel = {
  // File dialogs
  ShowOpenDialog: 'dialog:showOpen',
  ShowSaveDialog: 'dialog:showSave',

  // File I/O
  ReadFile: 'fs:readFile',
  WriteFile: 'fs:writeFile',

  // App info
  GetVersion: 'app:getVersion',

  // Menu actions (main → renderer)
  MenuNewMap: 'menu:newMap',
  MenuOpen: 'menu:open',
  MenuSave: 'menu:save',
  MenuSaveAs: 'menu:saveAs',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];
