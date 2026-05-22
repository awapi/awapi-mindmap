import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import { BrowserWindow, Menu, app, ipcMain, shell, dialog, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';

import { IpcChannel, type AutosavePayload } from './ipc.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Resources dir: <app>/resources in packaged, <repo>/resources in dev.
const resourcesPath =
  process.env['ELECTRON_RENDERER_URL'] !== undefined
    ? join(__dirname, '../../../../resources')
    : join(process.resourcesPath);

const MAX_RECENTS = 10;

// --- Persistent state (recents, autosave) ----------------------------------

function recentsFile(): string {
  return join(app.getPath('userData'), 'recent-files.json');
}

function autosaveFile(): string {
  return join(app.getPath('userData'), 'autosave.awmm');
}

async function loadRecents(): Promise<string[]> {
  try {
    const raw = await fs.readFile(recentsFile(), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENTS);
    }
  } catch {
    /* file missing or invalid — fall through */
  }
  return [];
}

async function saveRecents(paths: string[]): Promise<void> {
  await fs.writeFile(recentsFile(), JSON.stringify(paths, null, 2), 'utf8');
}

async function addRecent(path: string): Promise<string[]> {
  const current = await loadRecents();
  const next = [path, ...current.filter((p) => p !== path)].slice(0, MAX_RECENTS);
  await saveRecents(next);
  app.addRecentDocument(path);
  return next;
}

// --- Renderer-tracked state mirrored in main -------------------------------

let isDirty = false;
let currentFilePath: string | undefined;
let hasMap = false;
/** When true, we are mid-shutdown after a save-and-close confirmation. */
let allowNextClose = false;

/** Path requested via OS file-association (open-file / argv), buffered
 *  until the renderer is ready to receive it. */
let pendingOpenPath: string | undefined;
/** Set once the renderer has loaded and can accept open-path messages. */
let rendererReady = false;

/** Extract an `.awmm` path from argv (Windows/Linux file-association). */
function findAwmmInArgv(argv: readonly string[]): string | undefined {
  // Skip the first arg (executable). In packaged builds extra Chromium
  // switches may be present; pick the first existing-looking .awmm.
  return argv.slice(1).find((a) => !a.startsWith('-') && a.toLowerCase().endsWith('.awmm'));
}

function dispatchOpenPath(path: string): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
  win.webContents.send(IpcChannel.MenuOpenRecent, path);
}

function queueOrDispatchOpenPath(path: string): void {
  if (rendererReady) {
    dispatchOpenPath(path);
  } else {
    pendingOpenPath = path;
  }
}

// --- OS-level file-association wiring --------------------------------------

// Ensure a single instance on Windows/Linux so a second double-click
// reuses the existing window instead of launching a new app.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const path = findAwmmInArgv(argv);
    if (path) queueOrDispatchOpenPath(path);
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// macOS: Finder "Open With" routes through `open-file`. This can fire
// before `whenReady`, so we buffer the path.
app.on('open-file', (event, path) => {
  event.preventDefault();
  queueOrDispatchOpenPath(path);
});

function createWindow(): BrowserWindow {
  // Window icon: used on Windows/Linux title bars and taskbars.
  // macOS uses the icon embedded in the .app bundle (set by electron-builder),
  // so passing `icon` here is a harmless no-op on darwin.
  const winIcon = join(resourcesPath, process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'AwapiMindmap',
    icon: winIcon,
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

  // Once the renderer has finished loading, flush any pending open-path
  // request that came from the OS (file-association double-click).
  win.webContents.once('did-finish-load', () => {
    rendererReady = true;
    if (pendingOpenPath) {
      const p = pendingOpenPath;
      pendingOpenPath = undefined;
      dispatchOpenPath(p);
    }
  });
  win.on('closed', () => {
    rendererReady = false;
  });

  // Intercept window close to prompt on unsaved changes.
  win.on('close', (event) => {
    if (allowNextClose || !isDirty) return;
    event.preventDefault();
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Save', "Don't Save", 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved changes',
      message: 'You have unsaved changes.',
      detail: 'Do you want to save them before quitting?',
    });
    if (choice === 1) {
      // Don't Save — close without saving.
      allowNextClose = true;
      win.destroy();
    } else if (choice === 0) {
      // Save — delegate to renderer; it will call CloseWindow when done.
      win.webContents.send(IpcChannel.MenuSaveAndClose);
    }
    // choice === 2: Cancel — do nothing, window stays open.
  });

  return win;
}

async function buildMenu(): Promise<void> {
  const recents = await loadRecents();

  const recentSubmenu: Electron.MenuItemConstructorOptions[] =
    recents.length === 0
      ? [{ label: '(empty)', enabled: false }]
      : [
          ...recents.map<Electron.MenuItemConstructorOptions>((p) => ({
            label: p,
            click: (_item, win) =>
              (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuOpenRecent, p),
          })),
          { type: 'separator' },
          {
            label: 'Clear Recent',
            click: async () => {
              await saveRecents([]);
              app.clearRecentDocuments();
              await buildMenu();
            },
          },
        ];

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Map',
          accelerator: 'CmdOrCtrl+N',
          click: (_item, win) =>
            (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuNewMap),
        },
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          click: (_item, win) =>
            (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuOpen),
        },
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        {
          id: 'save',
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: hasMap,
          click: (_item, win) =>
            (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuSave),
        },
        {
          id: 'saveAs',
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: hasMap,
          click: (_item, win) =>
            (win as BrowserWindow | undefined)?.webContents.send(IpcChannel.MenuSaveAs),
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
          label: 'Check for Updates…',
          click: async () => {
            const win = BrowserWindow.getAllWindows()[0] ?? null;
            try {
              const result = await autoUpdater.checkForUpdates();
              if (result && result.updateInfo.version !== app.getVersion()) {
                const opts: Electron.MessageBoxOptions = {
                  type: 'info',
                  title: 'Update Available',
                  message: `Version ${result.updateInfo.version} is available.`,
                  detail: 'The update will be downloaded and installed automatically.',
                };
                void (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts));
              } else {
                const opts: Electron.MessageBoxOptions = {
                  type: 'info',
                  title: 'No Updates',
                  message: 'You are already on the latest version.',
                };
                void (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts));
              }
            } catch {
              const opts: Electron.MessageBoxOptions = {
                type: 'error',
                title: 'Update Check Failed',
                message: 'Unable to check for updates. Please try again later.',
              };
              void (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts));
            }
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

  ipcMain.handle(IpcChannel.ShowMessageBox, async (event, options: Electron.MessageBoxOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options);
  });

  ipcMain.handle(IpcChannel.ReadFile, async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf8');
  });

  ipcMain.handle(IpcChannel.WriteFile, async (_event, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf8');
  });

  ipcMain.handle(IpcChannel.GetVersion, () => app.getVersion());

  // Dirty / file path tracking
  ipcMain.handle(IpcChannel.SetDirty, (_event, dirty: boolean) => {
    isDirty = dirty;
  });
  ipcMain.handle(IpcChannel.SetFilePath, (_event, filePath: string | undefined) => {
    currentFilePath = filePath;
  });
  ipcMain.handle(IpcChannel.SetHasMap, async (_event, value: boolean) => {
    if (hasMap === value) return;
    hasMap = value;
    await buildMenu();
  });
  ipcMain.handle(IpcChannel.CloseWindow, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    allowNextClose = true;
    win.destroy();
  });

  // Recents
  ipcMain.handle(IpcChannel.RecentsGet, () => loadRecents());
  ipcMain.handle(IpcChannel.RecentsAdd, async (_event, path: string) => {
    const next = await addRecent(path);
    await buildMenu();
    return next;
  });
  ipcMain.handle(IpcChannel.RecentsClear, async () => {
    await saveRecents([]);
    app.clearRecentDocuments();
    await buildMenu();
  });

  // Updater
  ipcMain.handle(
    IpcChannel.UpdaterCheck,
    async (): Promise<{ available: boolean; version?: string }> => {
      try {
        const result = await autoUpdater.checkForUpdates();
        if (result && result.updateInfo.version !== app.getVersion()) {
          return { available: true, version: result.updateInfo.version };
        }
        return { available: false };
      } catch {
        return { available: false };
      }
    },
  );

  // Autosave
  ipcMain.handle(IpcChannel.AutosaveWrite, async (_event, payload: AutosavePayload) => {
    await fs.writeFile(autosaveFile(), JSON.stringify(payload), 'utf8');
  });
  ipcMain.handle(IpcChannel.AutosaveRead, async (): Promise<AutosavePayload | null> => {
    try {
      const raw = await fs.readFile(autosaveFile(), 'utf8');
      return JSON.parse(raw) as AutosavePayload;
    } catch {
      return null;
    }
  });
  ipcMain.handle(IpcChannel.AutosaveClear, async () => {
    try {
      await fs.unlink(autosaveFile());
    } catch {
      /* not present — fine */
    }
  });
}

app.whenReady().then(async () => {
  // In dev on macOS, the bundle icon is Electron's default. Override the
  // dock icon so the app shows our brand while running `pnpm dev`.
  if (process.platform === 'darwin' && process.env['ELECTRON_RENDERER_URL']) {
    const dockImg = nativeImage.createFromPath(join(resourcesPath, 'icon.png'));
    if (!dockImg.isEmpty()) app.dock?.setIcon(dockImg);
  }

  registerIpcHandlers();
  await buildMenu();
  createWindow();

  // If the app was launched by double-clicking a .awmm file in Explorer
  // (Windows/Linux), the path is in process.argv. Buffer it; the window's
  // `did-finish-load` will flush it once the renderer is ready.
  if (process.platform !== 'darwin') {
    const fromArgv = findAwmmInArgv(process.argv);
    if (fromArgv) pendingOpenPath = fromArgv;
  }

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

// Unused variable suppressed — currentFilePath is reserved for future
// use (e.g. window title in main, packaging metadata).
void currentFilePath;
