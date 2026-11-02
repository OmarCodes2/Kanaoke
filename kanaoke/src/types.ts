export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  source?: string;
  durationSec?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimingLine {
  index: number;
  startMs: number;
}

export interface TimingData {
  version: number;
  offsetMs: number;
  lines: TimingLine[];
}

export interface SongSummary {
  id: string;
  title: string;
  artist: string;
  status: 'synced' | 'needs-sync' | 'missing-lyrics' | 'invalid';
  path: string;
  coverPath?: string;
  durationSec?: number;
}

export interface SongData {
  meta: SongMeta;
  lyrics: {
    ja: string[];
    romaji?: string[];
    en?: string[];
  };
  timing?: TimingData;
  audioPath: string;
  coverPath?: string;
}

export interface AppSettings {
  libraryPath: string;
  dictionarySourcePath?: string;
}

export interface CreateSongPayload {
  title: string;
  artist: string;
  source?: string;
  audioPath: string;
  lyricsJa: string;
  lyricsRomaji?: string;
  lyricsEn?: string;
  coverPath?: string;
}

// Tokenization types
export interface TokenizedToken {
  surface: string;
  base: string;
  reading: string;
  pronunciation: string;
  pos: string;
  posDetail1: string;
  posDetail2: string;
  posDetail3: string;
  wordPosition: number;
  charStart: number;
  charEnd: number;
}

export interface DisplayToken {
  surface: string;
  base: string;
  reading: string;
  pronunciation: string;
  charStart: number;
  charEnd: number;
  underlyingTokens: TokenizedToken[];
}

export interface TokenizedLine {
  raw: string;
  tokens: TokenizedToken[];
}

export interface TokenizedData {
  version: number;
  createdAt: string;
  source: string;
  lines: TokenizedLine[];
}

export type DictionaryStatusState =
  | 'not-configured'
  | 'downloading'
  | 'building'
  | 'ready'
  | 'error';

export interface DictionaryStatus {
  status: DictionaryStatusState;
  progress?: number;
  message?: string;
  error?: string;
  sourcePath?: string;
}

export interface DictionaryInfo {
  status: DictionaryStatusState;
  sourcePath?: string;
}

export interface DictionaryLookupQuery {
  base: string;
  surface: string;
  reading: string;
}

export interface DictionarySenseResult {
  glosses: string[];
  partOfSpeech: string[];
}

export interface DictionaryLookupResult {
  id: string;
  kanji: string[];
  kana: string[];
  senses: DictionarySenseResult[];
  common: boolean;
}

export interface AnkiCardDraft {
  expression: string;
  reading: string;
  meaning: string;
  sentence: string;
  sentenceTranslation: string;
  songId: string;
  songTitle: string;
}

export interface AnkiStatus {
  connected: boolean;
  message: string;
  decks: string[];
}

export interface AnkiSaveResult {
  status: 'synced' | 'duplicate';
  message: string;
  noteId?: number;
}
