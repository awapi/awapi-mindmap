import { contextBridge, ipcRenderer } from 'electron';
import type { AwapiApi } from '../renderer/types/api.js';

const api: AwapiApi = {
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),
  showMessageBox: (options) => ipcRenderer.invoke('dialog:showMessageBox', options),

  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  setDirty: (dirty) => ipcRenderer.invoke('app:setDirty', dirty),
  setFilePath: (filePath) => ipcRenderer.invoke('app:setFilePath', filePath),
  setHasMap: (hasMap) => ipcRenderer.invoke('app:setHasMap', hasMap),
  closeWindow: () => ipcRenderer.invoke('app:closeWindow'),

  recentsGet: () => ipcRenderer.invoke('recents:get'),
  recentsAdd: (filePath) => ipcRenderer.invoke('recents:add', filePath),
  recentsClear: () => ipcRenderer.invoke('recents:clear'),

  autosaveWrite: (payload) => ipcRenderer.invoke('autosave:write', payload),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  autosaveClear: () => ipcRenderer.invoke('autosave:clear'),

  onMenuNewMap: (handler) => {
    ipcRenderer.on('menu:newMap', handler);
    return () => ipcRenderer.off('menu:newMap', handler);
  },
  onMenuOpen: (handler) => {
    ipcRenderer.on('menu:open', handler);
    return () => ipcRenderer.off('menu:open', handler);
  },
  onMenuSave: (handler) => {
    ipcRenderer.on('menu:save', handler);
    return () => ipcRenderer.off('menu:save', handler);
  },
  onMenuSaveAs: (handler) => {
    ipcRenderer.on('menu:saveAs', handler);
    return () => ipcRenderer.off('menu:saveAs', handler);
  },
  onMenuOpenRecent: (handler) => {
    const wrapped = (event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      handler(event, args[0] as string);
    ipcRenderer.on('menu:openRecent', wrapped);
    return () => ipcRenderer.off('menu:openRecent', wrapped);
  },
  onMenuSaveAndClose: (handler) => {
    ipcRenderer.on('menu:saveAndClose', handler);
    return () => ipcRenderer.off('menu:saveAndClose', handler);
  },
};

contextBridge.exposeInMainWorld('awapi', api);
