import { app, BrowserWindow, ipcMain, dialog, shell, protocol, Menu } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { getSettings, setSettings } from './main/settings';
import {
  scanLibrary,
  readSong,
  createSong,
  importSongFolder,
  saveTiming,
  getSongAudioPath,
  ensureTokenized,
  getTokenized,
} from './main/songMapUtils';
import type { CreateSongPayload, TimingData, DictionaryLookupQuery, DictionaryLookupResult, DictionaryStatus } from './types';
import { jmdictService } from './main/dictionary/jmdictService';
import {
  createAnkiDeck,
  getAnkiDecks,
  getAnkiStatus,
  saveAnkiCard,
} from './main/anki';
import type { AnkiCardDraft } from './types';

if (started) {
  app.quit();
}
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'kanaoke',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (process.env.NODE_ENV === 'development' || MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
};

ipcMain.handle('get-settings', async () => {
  return await getSettings();
});

ipcMain.handle('set-library-path', async (_event, libraryPath: string) => {
  const settings = await getSettings();
  settings.libraryPath = libraryPath;
  await setSettings(settings);
});

ipcMain.handle('choose-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0] || null;
});

ipcMain.handle('choose-file', async (_event, filters?: { name: string; extensions: string[] }[]) => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0] || null;
});

ipcMain.handle('scan-library', async (_event, libraryPath: string) => {
  return await scanLibrary(libraryPath);
});

ipcMain.handle('read-song', async (_event, id: string) => {
  const settings = await getSettings();
  return await readSong(settings.libraryPath, id);
});

ipcMain.handle('create-song', async (_event, payload: CreateSongPayload) => {
  const settings = await getSettings();
  return await createSong(settings.libraryPath, payload);
});

ipcMain.handle('import-song-folder', async (_event, sourcePath: string) => {
  const settings = await getSettings();
  return await importSongFolder(settings.libraryPath, sourcePath);
});

ipcMain.handle('save-timing', async (_event, id: string, timing: TimingData) => {
  const settings = await getSettings();
  await saveTiming(settings.libraryPath, id, timing);
});

ipcMain.handle('open-in-explorer', async (_event, songPath: string) => {
  shell.showItemInFolder(songPath);
});

ipcMain.handle('get-audio-blob-url', async (_event, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found: ' + filePath);
    }
    const fileBuffer = await fs.promises.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'audio/mpeg'; // default
    if (ext === '.mp3') mimeType = 'audio/mpeg';
    else if (ext === '.wav') mimeType = 'audio/wav';
    else if (ext === '.ogg') mimeType = 'audio/ogg';
    else if (ext === '.m4a') mimeType = 'audio/mp4';
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return dataUrl;
  } catch (error) {
    console.error('Error creating data URL:', error);
    throw error;
  }
});

ipcMain.handle('get-cover-image-url', async (_event, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error('File not found: ' + filePath);
    }
    const fileBuffer = await fs.promises.readFile(filePath);
    const base64 = fileBuffer.toString('base64');
    const ext = path.extname(filePath).toLowerCase();
    let mimeType = 'image/jpeg'; // default
    if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    
    const dataUrl = `data:${mimeType};base64,${base64}`;
    return dataUrl;
  } catch (error) {
    console.error('Error creating cover image data URL:', error);
    throw error;
  }
});

ipcMain.handle('get-song-audio-path', async (_event, id: string) => {
  const settings = await getSettings();
  return await getSongAudioPath(settings.libraryPath, id);
});

ipcMain.handle('song:ensure-tokenized', async (_event, songId: string) => {
  const settings = await getSettings();
  return await ensureTokenized(settings.libraryPath, songId);
});

ipcMain.handle('song:get-tokenized', async (_event, songId: string) => {
  const settings = await getSettings();
  return await getTokenized(settings.libraryPath, songId);
});

ipcMain.handle('dictionary:get-status', async () => {
  return jmdictService.getStatus();
});

ipcMain.handle('dictionary:get-info', async () => {
  return jmdictService.getInfo();
});

ipcMain.handle('dictionary:lookup', async (_event, query: DictionaryLookupQuery) => {
  return jmdictService.lookup(query);
});

ipcMain.handle('dictionary:download-and-install', async () => {
  await jmdictService.downloadAndInstall();
});

ipcMain.handle('dictionary:install-from-path', async (_event, sourcePath: string) => {
  await jmdictService.installFromPath(sourcePath);
});

ipcMain.handle('dictionary:choose-and-install', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'JMdict dictionary', extensions: ['json', 'zip'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) {
    return null;
  }
  await jmdictService.installFromPath(result.filePaths[0]);
  return result.filePaths[0];
});

ipcMain.handle('anki:get-status', async () => getAnkiStatus());
ipcMain.handle('anki:get-decks', async () => getAnkiDecks());
ipcMain.handle('anki:create-deck', async (_event, name: string) => createAnkiDeck(name));
ipcMain.handle('anki:save-card', async (_event, card: AnkiCardDraft, deckName: string) =>
  saveAnkiCard(card, deckName),
);

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  jmdictService.tryLoadExisting().catch((error) => {
    console.error('Dictionary load failed:', error);
  });
  
  protocol.registerFileProtocol('kanaoke', (request, callback) => {
    try {
      let urlString = request.url.replace(/^kanaoke:\/\//, '');
      
      let filePath: string;
      try {
        filePath = decodeURIComponent(urlString);
      } catch (e) {
        filePath = urlString;
      }
      
      if (process.platform === 'win32') {
        filePath = filePath.replace(/\//g, '\\');
      }
      
      if (fs.existsSync(filePath)) {
        callback({ path: filePath });
        return;
      }
      
      if (process.platform === 'win32') {
        const forwardSlashPath = filePath.replace(/\\/g, '/');
        if (fs.existsSync(forwardSlashPath)) {
          callback({ path: forwardSlashPath });
          return;
        }
      }
      
      console.error('[PROTOCOL] File not found:', filePath);
      callback({ error: -6 });
    } catch (error) {
      console.error('[PROTOCOL] Handler error:', error);
      callback({ error: -2 });
    }
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
