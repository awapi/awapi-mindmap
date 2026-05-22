import { contextBridge, ipcRenderer } from 'electron';
import type { AwapiApi } from '../renderer/types/api.js';

const api: AwapiApi = {
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),

  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),

  getVersion: () => ipcRenderer.invoke('app:getVersion'),

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
};

contextBridge.exposeInMainWorld('awapi', api);
