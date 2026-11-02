import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import type { AppSettings } from '../types';

const SETTINGS_FILE = 'settings.json';

export async function getSettings(): Promise<AppSettings> {
  const userDataPath = app.getPath('userData');
  const settingsPath = path.join(userDataPath, SETTINGS_FILE);

  try {
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings: AppSettings = JSON.parse(content);
    
    // Ensure library path exists
    if (!settings.libraryPath) {
      settings.libraryPath = path.join(userDataPath, 'KanaokeLibrary');
    }
    
    return settings;
  } catch {
    // Default settings
    const defaultLibraryPath = path.join(userDataPath, 'KanaokeLibrary');
    const defaultSettings: AppSettings = {
      libraryPath: defaultLibraryPath,
    };
    
    // Save default settings
    await setSettings(defaultSettings);
    
    return defaultSettings;
  }
}

export async function setSettings(settings: AppSettings): Promise<void> {
  const userDataPath = app.getPath('userData');
  const settingsPath = path.join(userDataPath, SETTINGS_FILE);
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}











