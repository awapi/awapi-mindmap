import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { BrowserWindow, Menu, app, ipcMain, shell, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

import { IpcChannel } from './ipc.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Resources dir: <app>/resources in packaged, <repo>/resources in dev.
const resourcesPath =
  process.env['ELECTRON_RENDERER_URL'] !== undefined
    ? join(__dirname, '../../../../resources')
    : join(process.resourcesPath);

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AwapiMindmap',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Map',
          accelerator: 'CmdOrCtrl+N',
          click: (_item, win) => (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuNewMap),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) => (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuOpen),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: (_item, win) => (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuSave),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: (_item, win) => (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuSaveAs),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About AwapiMindmap',
          click: () => {
            dialog.showMessageBox({
              title: 'AwapiMindmap',
              message: `AwapiMindmap\nVersion ${app.getVersion()}`,
              detail: 'Cross-platform mind map designer by Awapi.',
            });
          },
        },
        {
          label: 'GitHub',
          click: () => shell.openExternal('https://github.com/awapi/awapi-mindmap'),
        },
      ],
    },
  ];

  // macOS: prepend the standard app menu.
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.ShowOpenDialog, async (_event, options: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(options);
  });

  ipcMain.handle(IpcChannel.ShowSaveDialog, async (_event, options: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(options);
  });

  ipcMain.handle(IpcChannel.ReadFile, async (_event, filePath: string) => {
    const { promises: fs } = await import('node:fs');
    return fs.readFile(filePath, 'utf8');
  });

  ipcMain.handle(IpcChannel.WriteFile, async (_event, filePath: string, content: string) => {
    const { promises: fs } = await import('node:fs');
    await fs.writeFile(filePath, content, 'utf8');
  });

  ipcMain.handle(IpcChannel.GetVersion, () => app.getVersion());
}

app.whenReady().then(() => {
  registerIpcHandlers();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Check for updates in production.
  if (!process.env['ELECTRON_RENDERER_URL']) {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.error('Auto-updater error:', err);
    });
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Prevent navigation to external URLs (security).
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const { origin } = new URL(url);
    const devOrigin = process.env['ELECTRON_RENDERER_URL']
      ? new URL(process.env['ELECTRON_RENDERER_URL']).origin
      : null;
    if (origin !== 'null' && origin !== devOrigin) {
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});

// Unused variable suppressed — resourcesPath reserved for icon lookup once
// a branded icon is added to resources/.
void resourcesPath;
