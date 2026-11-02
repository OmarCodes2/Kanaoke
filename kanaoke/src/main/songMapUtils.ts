import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseFile } from 'music-metadata';
import type {
  SongSummary,
  SongData,
  SongMeta,
  CreateSongPayload,
  TimingData,
  TokenizedData,
} from '../types';
import { tokenizeLyrics } from './tokenizer';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a'];
const COVER_EXTENSIONS = ['.png', '.jpg', '.jpeg'];

export async function scanLibrary(libraryPath: string): Promise<SongSummary[]> {
  try {
    await fs.mkdir(libraryPath, { recursive: true });

    const entries = await fs.readdir(libraryPath, { withFileTypes: true });
    const songs: SongSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || !entry.name.endsWith('.osj')) {
        continue;
      }

      const songPath = path.join(libraryPath, entry.name);
      try {
        const metaPath = path.join(songPath, 'meta.json');
        const metaContent = await fs.readFile(metaPath, 'utf-8');
        const meta: SongMeta = JSON.parse(metaContent);

        const timingPath = path.join(songPath, 'timing.json');
        const lyricsJaPath = path.join(songPath, 'lyrics_ja.txt');
        
        const hasTiming = await fileExists(timingPath);
        const hasLyricsJa = await fileExists(lyricsJaPath);

        let status: SongSummary['status'] = 'invalid';
        if (!hasLyricsJa) {
          status = 'missing-lyrics';
        } else if (!hasTiming) {
          status = 'needs-sync';
        } else {
          try {
            const timingContent = await fs.readFile(timingPath, 'utf-8');
            const timing: TimingData = JSON.parse(timingContent);
            
            const lyricsContent = await fs.readFile(lyricsJaPath, 'utf-8');
            const lyricsLines = lyricsContent.split('\n').filter((line) => line.trim() !== '');
            
            const allLinesStamped = timing.lines.every(
              (line) => typeof line.startMs === 'number' && line.startMs > 0
            );
            
            const lineCountsMatch = timing.lines.length === lyricsLines.length;
            
            if (allLinesStamped && lineCountsMatch) {
              status = 'synced';
            } else {
              status = 'needs-sync';
            }
          } catch (error) {
            status = 'needs-sync';
          }
        }

        const coverFiles = await findFilesWithExtensions(songPath, COVER_EXTENSIONS);
        let coverPath: string | undefined;
        if (coverFiles.length > 0) {
          const coverNamedFile = coverFiles.find(f => {
            const fileName = path.basename(f).toLowerCase();
            return fileName.startsWith('cover');
          });
          coverPath = coverNamedFile || coverFiles[0];
        }

        let durationSec = meta.durationSec;
        if (!durationSec) {
          try {
            const audioFiles = await findFilesWithExtensions(songPath, AUDIO_EXTENSIONS);
            if (audioFiles.length > 0) {
              const audioPath = audioFiles[0];
              const metadata = await parseFile(audioPath);
              if (metadata.format.duration) {
                durationSec = Math.round(metadata.format.duration);
                meta.durationSec = durationSec;
                meta.updatedAt = new Date().toISOString();
                await fs.writeFile(
                  metaPath,
                  JSON.stringify(meta, null, 2),
                );
              }
            }
          } catch (error) {
          }
        }

        songs.push({
          id: meta.id,
          title: meta.title,
          artist: meta.artist,
          durationSec,
          status,
          path: songPath,
          coverPath,
        });
      } catch (error) {
        console.error(`Error reading song ${entry.name}:`, error);
      }
    }

    return songs;
  } catch (error) {
    console.error('Error scanning library:', error);
    throw error;
  }
}

export async function readSong(
  libraryPath: string,
  id: string,
): Promise<SongData> {
  // Find the song folder
  const entries = await fs.readdir(libraryPath, { withFileTypes: true });
  let songPath: string | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.osj')) {
      continue;
    }

    const candidatePath = path.join(libraryPath, entry.name);
    try {
      const metaPath = path.join(candidatePath, 'meta.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta: SongMeta = JSON.parse(metaContent);

      if (meta.id === id) {
        songPath = candidatePath;
        break;
      }
    } catch {
      // Continue searching
    }
  }

  if (!songPath) {
    throw new Error(`Song with id ${id} not found`);
  }

  const metaPath = path.join(songPath, 'meta.json');
  const metaContent = await fs.readFile(metaPath, 'utf-8');
  const meta: SongMeta = JSON.parse(metaContent);

  const lyrics: SongData['lyrics'] = {
    ja: [],
    romaji: undefined,
    en: undefined,
  };

  const lyricsJaPath = path.join(songPath, 'lyrics_ja.txt');
  if (await fileExists(lyricsJaPath)) {
    const content = await fs.readFile(lyricsJaPath, 'utf-8');
    lyrics.ja = content.split('\n').filter((line) => line.trim() !== '');
  }

  const lyricsRomajiPath = path.join(songPath, 'lyrics_romaji.txt');
  if (await fileExists(lyricsRomajiPath)) {
    const content = await fs.readFile(lyricsRomajiPath, 'utf-8');
    lyrics.romaji = content.split('\n').filter((line) => line.trim() !== '');
  }

  const lyricsEnPath = path.join(songPath, 'lyrics_en.txt');
  if (await fileExists(lyricsEnPath)) {
    const content = await fs.readFile(lyricsEnPath, 'utf-8');
    lyrics.en = content.split('\n').filter((line) => line.trim() !== '');
  }

  let timing: TimingData | undefined;
  const timingPath = path.join(songPath, 'timing.json');
  if (await fileExists(timingPath)) {
    const timingContent = await fs.readFile(timingPath, 'utf-8');
    timing = JSON.parse(timingContent);
  }

  const audioFiles = await findFilesWithExtensions(songPath, AUDIO_EXTENSIONS);
  if (audioFiles.length === 0) {
    throw new Error(`No audio file found in ${songPath}`);
  }
  const audioPath = audioFiles[0];

  const coverFiles = await findFilesWithExtensions(songPath, COVER_EXTENSIONS);
  let coverPath: string | undefined;
  if (coverFiles.length > 0) {
    const coverNamedFile = coverFiles.find(f => {
      const fileName = path.basename(f).toLowerCase();
      return fileName.startsWith('cover');
    });
    coverPath = coverNamedFile || coverFiles[0];
  }

  return {
    meta,
    lyrics,
    timing,
    audioPath,
    coverPath,
  };
}

export async function getSongAudioPath(
  libraryPath: string,
  id: string,
): Promise<string | null> {
  const entries = await fs.readdir(libraryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.osj')) {
      continue;
    }

    const candidatePath = path.join(libraryPath, entry.name);
    try {
      const metaPath = path.join(candidatePath, 'meta.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta: SongMeta = JSON.parse(metaContent);

      if (meta.id === id) {
        const audioFiles = await findFilesWithExtensions(candidatePath, AUDIO_EXTENSIONS);
        if (audioFiles.length > 0) {
          return audioFiles[0];
        }
        return null;
      }
    } catch {
    }
  }

  return null;
}

export async function createSong(
  libraryPath: string,
  payload: CreateSongPayload,
): Promise<string> {
  await fs.mkdir(libraryPath, { recursive: true });

  const id = randomUUID();
  const safeTitle = sanitizeFileName(payload.title);
  const folderName = `${safeTitle}.osj`;
  const songPath = path.join(libraryPath, folderName);

  await fs.mkdir(songPath, { recursive: true });

  const now = new Date().toISOString();
  const meta: SongMeta = {
    id,
    title: payload.title,
    artist: payload.artist,
    source: payload.source,
    createdAt: now,
    updatedAt: now,
  };
  await fs.writeFile(
    path.join(songPath, 'meta.json'),
    JSON.stringify(meta, null, 2),
  );

  const audioExt = path.extname(payload.audioPath);
  const audioDest = path.join(songPath, `audio${audioExt}`);
  await fs.copyFile(payload.audioPath, audioDest);

  await fs.writeFile(
    path.join(songPath, 'lyrics_ja.txt'),
    payload.lyricsJa,
  );

  if (payload.lyricsRomaji) {
    await fs.writeFile(
      path.join(songPath, 'lyrics_romaji.txt'),
      payload.lyricsRomaji,
    );
  }

  if (payload.lyricsEn) {
    await fs.writeFile(
      path.join(songPath, 'lyrics_en.txt'),
      payload.lyricsEn,
    );
  }

  if (payload.coverPath) {
    const coverExt = path.extname(payload.coverPath);
    const coverDest = path.join(songPath, `cover${coverExt}`);
    await fs.copyFile(payload.coverPath, coverDest);
  }

  return id;
}

export async function importSongFolder(
  libraryPath: string,
  sourcePath: string,
): Promise<string> {
  await fs.mkdir(libraryPath, { recursive: true });

  const sourceMetaPath = path.join(sourcePath, 'meta.json');
  const metaContent = await fs.readFile(sourceMetaPath, 'utf-8');
  const meta: SongMeta = JSON.parse(metaContent);

  const safeTitle = sanitizeFileName(meta.title);
  const folderName = `${safeTitle}.osj`;
  const destPath = path.join(libraryPath, folderName);

  if (await fileExists(destPath)) {
    const existingMetaPath = path.join(destPath, 'meta.json');
    const existingMetaContent = await fs.readFile(existingMetaPath, 'utf-8');
    const existingMeta: SongMeta = JSON.parse(existingMetaContent);
    
    meta.updatedAt = new Date().toISOString();
    meta.createdAt = existingMeta.createdAt;
    await fs.writeFile(
      existingMetaPath,
      JSON.stringify(meta, null, 2),
    );

    await copySongFiles(sourcePath, destPath);
    
    return existingMeta.id;
  }

  await copyDirectory(sourcePath, destPath);

  return meta.id;
}

export async function saveTiming(
  libraryPath: string,
  id: string,
  timing: TimingData,
): Promise<void> {
  const entries = await fs.readdir(libraryPath, { withFileTypes: true });
  let songPath: string | null = null;

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.osj')) {
      continue;
    }

    const candidatePath = path.join(libraryPath, entry.name);
    try {
      const metaPath = path.join(candidatePath, 'meta.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta: SongMeta = JSON.parse(metaContent);

      if (meta.id === id) {
        songPath = candidatePath;
        break;
      }
    } catch {
    }
  }

  if (!songPath) {
    throw new Error(`Song with id ${id} not found`);
  }

  const timingPath = path.join(songPath, 'timing.json');
  await fs.writeFile(timingPath, JSON.stringify(timing, null, 2));

  const metaPath = path.join(songPath, 'meta.json');
  const metaContent = await fs.readFile(metaPath, 'utf-8');
  const meta: SongMeta = JSON.parse(metaContent);
  meta.updatedAt = new Date().toISOString();
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findFilesWithExtensions(
  dirPath: string,
  extensions: string[],
): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (extensions.includes(ext)) {
        files.push(path.join(dirPath, entry.name));
      }
    }
  }

  return files;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

async function copyDirectory(source: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      await fs.copyFile(sourcePath, destPath);
    }
  }
}

async function copySongFiles(source: string, dest: string): Promise<void> {
  const sourceAudioFiles = await findFilesWithExtensions(source, AUDIO_EXTENSIONS);
  for (const audioFile of sourceAudioFiles) {
    const ext = path.extname(audioFile);
    const destAudio = path.join(dest, `audio${ext}`);
    await fs.copyFile(audioFile, destAudio);
  }

  const lyricsFiles = ['lyrics_ja.txt', 'lyrics_romaji.txt', 'lyrics_en.txt'];
  for (const lyricsFile of lyricsFiles) {
    const sourcePath = path.join(source, lyricsFile);
    if (await fileExists(sourcePath)) {
      await fs.copyFile(sourcePath, path.join(dest, lyricsFile));
    }
  }

  const sourceCoverFiles = await findFilesWithExtensions(source, COVER_EXTENSIONS);
  for (const coverFile of sourceCoverFiles) {
    const ext = path.extname(coverFile);
    const destCover = path.join(dest, `cover${ext}`);
    await fs.copyFile(coverFile, destCover);
  }

  const sourceTiming = path.join(source, 'timing.json');
  if (await fileExists(sourceTiming)) {
    await fs.copyFile(sourceTiming, path.join(dest, 'timing.json'));
  }

  const sourceTokenized = path.join(source, 'tokenized.json');
  if (await fileExists(sourceTokenized)) {
    await fs.copyFile(sourceTokenized, path.join(dest, 'tokenized.json'));
  }
}

export async function getSongPath(
  libraryPath: string,
  id: string,
): Promise<string | null> {
  const entries = await fs.readdir(libraryPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.endsWith('.osj')) {
      continue;
    }

    const candidatePath = path.join(libraryPath, entry.name);
    try {
      const metaPath = path.join(candidatePath, 'meta.json');
      const metaContent = await fs.readFile(metaPath, 'utf-8');
      const meta: SongMeta = JSON.parse(metaContent);

      if (meta.id === id) {
        return candidatePath;
      }
    } catch {
    }
  }

  return null;
}

export async function ensureTokenized(
  libraryPath: string,
  id: string,
): Promise<TokenizedData> {
  const songPath = await getSongPath(libraryPath, id);
  if (!songPath) {
    throw new Error(`Song with id ${id} not found`);
  }

  const tokenizedPath = path.join(songPath, 'tokenized.json');
  
  if (await fileExists(tokenizedPath)) {
    try {
      const content = await fs.readFile(tokenizedPath, 'utf-8');
      return JSON.parse(content) as TokenizedData;
    } catch (error) {
    }
  }

  const lyricsJaPath = path.join(songPath, 'lyrics_ja.txt');
  if (!(await fileExists(lyricsJaPath))) {
    throw new Error(`lyrics_ja.txt not found for song ${id}`);
  }

  const lyricsContent = await fs.readFile(lyricsJaPath, 'utf-8');
  const lyricsLines = lyricsContent.split('\n').filter((line) => line.trim() !== '');
  
  const tokenized = await tokenizeLyrics(lyricsLines);
  
  await fs.writeFile(tokenizedPath, JSON.stringify(tokenized, null, 2));
  
  return tokenized;
}

export async function getTokenized(
  libraryPath: string,
  id: string,
): Promise<TokenizedData | null> {
  const songPath = await getSongPath(libraryPath, id);
  if (!songPath) {
    return null;
  }

  const tokenizedPath = path.join(songPath, 'tokenized.json');
  if (!(await fileExists(tokenizedPath))) {
    return null;
  }

  try {
    const content = await fs.readFile(tokenizedPath, 'utf-8');
    return JSON.parse(content) as TokenizedData;
  } catch (error) {
    console.error(`Failed to read tokenized.json for ${id}:`, error);
    return null;
  }
}
