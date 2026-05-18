import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { orchestrate, parseFileOperationWithLLM } from './orchestrator';
import { startFileWatcher } from '../ai/indexer';
let win: BrowserWindow | null = null;

console.log('Main process started');

function createWindow() {
  win = new BrowserWindow({
    width: 600,
    height: 600,
    resizable: false,
    alwaysOnTop: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false, // Start hidden
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }

  win.on('blur', () => {
    if (win && win.isVisible()) {
      win.hide();
    }
  });
}

function registerGlobalHotkey() {
  // First, check if Alt+L is already registered
  const isRegistered = globalShortcut.isRegistered('Alt+L');
  console.log('Is Alt+L already registered?', isRegistered);
  if (!isRegistered) {
    const success = globalShortcut.register('Alt+L', () => {
      console.log('Alt+L pressed!');
      if (!win) return;
      if (win.isVisible()) {
        console.log('Hiding window');
        win.hide();
      } else {
        console.log('Showing window');
        win.show();
        win.focus();
      }
    });
    console.log('Hotkey Alt+L registered:', success);
  } else {
    console.log('Alt+L is already registered by another application.');
  }
}

app.whenReady().then(() => {
  createWindow();
  registerGlobalHotkey();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  ipcMain.handle('user-query', async (_event, payload) => {
    const query = typeof payload === 'string' ? payload : payload.query;
    const file = typeof payload === 'object' && payload.file ? payload.file : undefined;
    return await orchestrate(query, file);
  });

  ipcMain.handle('parse-file-operation', async (_event, payload) => {
    const query = typeof payload === 'string' ? payload : payload.query;
    const file = typeof payload === 'object' && payload.file ? payload.file : undefined;
    return await parseFileOperationWithLLM(query, file);
  });

  startFileWatcher(path.join(os.homedir(), 'Downloads'));
  console.log('After startFileWatcher call');
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
}); 