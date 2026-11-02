import { contextBridge, ipcRenderer } from 'electron';
import type {
  SongSummary,
  SongData,
  AppSettings,
  CreateSongPayload,
  TimingData,
  TokenizedData,
  DictionaryStatus,
  DictionaryLookupQuery,
  DictionaryLookupResult,
  DictionaryInfo,
  AnkiCardDraft,
  AnkiStatus,
  AnkiSaveResult,
} from './types';

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('get-settings'),
  setLibraryPath: (path: string): Promise<void> => ipcRenderer.invoke('set-library-path', path),

  chooseDirectory: (): Promise<string | null> => ipcRenderer.invoke('choose-directory'),
  chooseFile: (filters?: { name: string; extensions: string[] }[]): Promise<string | null> =>
    ipcRenderer.invoke('choose-file', filters),

  scanLibrary: (libraryPath: string): Promise<SongSummary[]> =>
    ipcRenderer.invoke('scan-library', libraryPath),
  readSong: (id: string): Promise<SongData> => ipcRenderer.invoke('read-song', id),
  createSong: (payload: CreateSongPayload): Promise<string> =>
    ipcRenderer.invoke('create-song', payload),
  importSongFolder: (sourcePath: string): Promise<string> =>
    ipcRenderer.invoke('import-song-folder', sourcePath),
  saveTiming: (id: string, timing: TimingData): Promise<void> =>
    ipcRenderer.invoke('save-timing', id, timing),
  openInExplorer: (songPath: string): Promise<void> =>
    ipcRenderer.invoke('open-in-explorer', songPath),
  getAudioBlobUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('get-audio-blob-url', filePath),
  getCoverImageUrl: (filePath: string): Promise<string> =>
    ipcRenderer.invoke('get-cover-image-url', filePath),
  getSongAudioPath: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('get-song-audio-path', id),
  
  ensureTokenized: (songId: string): Promise<TokenizedData> =>
    ipcRenderer.invoke('song:ensure-tokenized', songId),
  getTokenized: (songId: string): Promise<TokenizedData | null> =>
    ipcRenderer.invoke('song:get-tokenized', songId),

  getDictionaryStatus: (): Promise<DictionaryStatus> =>
    ipcRenderer.invoke('dictionary:get-status'),
  getDictionaryInfo: (): Promise<DictionaryInfo> =>
    ipcRenderer.invoke('dictionary:get-info'),
  downloadDictionary: (): Promise<void> =>
    ipcRenderer.invoke('dictionary:download-and-install'),
  chooseDictionaryFile: (): Promise<string | null> =>
    ipcRenderer.invoke('dictionary:choose-and-install'),
  installDictionaryFromPath: (sourcePath: string): Promise<void> =>
    ipcRenderer.invoke('dictionary:install-from-path', sourcePath),
  lookupDictionary: (query: DictionaryLookupQuery): Promise<DictionaryLookupResult[]> =>
    ipcRenderer.invoke('dictionary:lookup', query),
  onDictionaryStatusChanged: (callback: (status: DictionaryStatus) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: DictionaryStatus) => {
      callback(status);
    };
    ipcRenderer.on('dictionary:status-changed', listener);
    return () => {
      ipcRenderer.removeListener('dictionary:status-changed', listener);
    };
  },

  getAnkiStatus: (): Promise<AnkiStatus> => ipcRenderer.invoke('anki:get-status'),
  getAnkiDecks: (): Promise<string[]> => ipcRenderer.invoke('anki:get-decks'),
  createAnkiDeck: (name: string): Promise<string> => ipcRenderer.invoke('anki:create-deck', name),
  saveAnkiCard: (card: AnkiCardDraft, deckName: string): Promise<AnkiSaveResult> =>
    ipcRenderer.invoke('anki:save-card', card, deckName),
});

declare global {
  interface Window {
    electronAPI: {
      getSettings: () => Promise<AppSettings>;
      setLibraryPath: (path: string) => Promise<void>;
      chooseDirectory: () => Promise<string | null>;
      chooseFile: (filters?: { name: string; extensions: string[] }[]) => Promise<string | null>;
      scanLibrary: (libraryPath: string) => Promise<SongSummary[]>;
      readSong: (id: string) => Promise<SongData>;
      createSong: (payload: CreateSongPayload) => Promise<string>;
      importSongFolder: (sourcePath: string) => Promise<string>;
      saveTiming: (id: string, timing: TimingData) => Promise<void>;
      openInExplorer: (songPath: string) => Promise<void>;
      getAudioBlobUrl: (filePath: string) => Promise<string>;
      getCoverImageUrl: (filePath: string) => Promise<string>;
      getSongAudioPath: (id: string) => Promise<string | null>;
      ensureTokenized: (songId: string) => Promise<TokenizedData>;
      getTokenized: (songId: string) => Promise<TokenizedData | null>;
      getDictionaryStatus: () => Promise<DictionaryStatus>;
      getDictionaryInfo: () => Promise<DictionaryInfo>;
      downloadDictionary: () => Promise<void>;
      chooseDictionaryFile: () => Promise<string | null>;
      installDictionaryFromPath: (sourcePath: string) => Promise<void>;
      lookupDictionary: (query: DictionaryLookupQuery) => Promise<DictionaryLookupResult[]>;
      onDictionaryStatusChanged: (callback: (status: DictionaryStatus) => void) => () => void;
      getAnkiStatus: () => Promise<AnkiStatus>;
      getAnkiDecks: () => Promise<string[]>;
      createAnkiDeck: (name: string) => Promise<string>;
      saveAnkiCard: (card: AnkiCardDraft, deckName: string) => Promise<AnkiSaveResult>;
    };
  }
}
