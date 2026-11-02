import fs from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import type {
  DictionaryIndex,
  DictionaryLookupQuery,
  DictionaryLookupResult,
} from '../../utils/dictionaryLookup';
import { lookupInIndex } from '../../utils/dictionaryLookup';
import type { DictionaryInfo, DictionaryStatus } from '../../types';
import { getSettings, setSettings } from '../settings';
import { buildDictionaryIndex, readDictionaryIndex, writeDictionaryIndex } from './buildIndex';
import { downloadJmdict } from './downloadJmdict';
import { isDictionarySourceFile, resolveDictionaryJsonPath } from './resolveSource';

const JMDICT_FILENAME = 'jmdict-eng.json';
const INDEX_FILENAME = 'index.json';

class JmdictService {
  private index: DictionaryIndex | null = null;
  private status: DictionaryStatus = { status: 'not-configured' };
  private installPromise: Promise<void> | null = null;

  getStatus(): DictionaryStatus {
    return this.status;
  }

  async getInfo(): Promise<DictionaryInfo> {
    const settings = await getSettings();
    return {
      status: this.status.status,
      sourcePath: settings.dictionarySourcePath,
    };
  }

  private setStatus(next: DictionaryStatus): void {
    this.status = next;
    BrowserWindow.getAllWindows().forEach((window) => {
      window.webContents.send('dictionary:status-changed', next);
    });
  }

  private getDictionaryDir(): string {
    return path.join(app.getPath('userData'), 'dictionary');
  }

  private getManagedSourcePath(): string {
    return path.join(this.getDictionaryDir(), JMDICT_FILENAME);
  }

  private getIndexPath(): string {
    return path.join(this.getDictionaryDir(), INDEX_FILENAME);
  }

  private async updateStatusFromSettings(): Promise<void> {
    const settings = await getSettings();
    if (this.status.status === 'ready') {
      return;
    }
    this.setStatus({
      status: 'not-configured',
      sourcePath: settings.dictionarySourcePath,
      message: settings.dictionarySourcePath
        ? 'Dictionary file selected. Build the index to enable meanings.'
        : 'Download JMdict or choose a local dictionary file to enable word meanings.',
    });
  }

  async tryLoadExisting(): Promise<void> {
    if (this.index) {
      return;
    }

    const settings = await getSettings();
    const indexPath = this.getIndexPath();

    try {
      const index = await readDictionaryIndex(indexPath);
      if (settings.dictionarySourcePath && index.meta.sourcePath) {
        try {
          const stat = await fs.stat(settings.dictionarySourcePath);
          if (
            index.meta.sourcePath !== settings.dictionarySourcePath ||
            (index.meta.sourceMtimeMs !== undefined &&
              index.meta.sourceMtimeMs !== stat.mtimeMs)
          ) {
            await this.updateStatusFromSettings();
            return;
          }
        } catch {
          await this.updateStatusFromSettings();
          return;
        }
      }

      this.index = index;
      this.setStatus({
        status: 'ready',
        sourcePath: settings.dictionarySourcePath,
      });
    } catch {
      await this.updateStatusFromSettings();
    }
  }

  async downloadAndInstall(): Promise<void> {
    if (this.installPromise) {
      await this.installPromise;
      return;
    }

    this.installPromise = this.runInstall(async () => {
      const managedSourcePath = this.getManagedSourcePath();
      await fs.mkdir(this.getDictionaryDir(), { recursive: true });

      this.setStatus({
        status: 'downloading',
        progress: 0,
        message: 'Downloading JMdict (~114MB)...',
      });

      await downloadJmdict(managedSourcePath, (progress) => {
        this.setStatus({
          status: 'downloading',
          progress,
          message: 'Downloading JMdict (~114MB)...',
        });
      });

      const settings = await getSettings();
      settings.dictionarySourcePath = managedSourcePath;
      await setSettings(settings);

      await this.buildIndexFromSource(managedSourcePath);
    });

    try {
      await this.installPromise;
    } finally {
      this.installPromise = null;
    }
  }

  async installFromPath(sourcePath: string): Promise<void> {
    if (!isDictionarySourceFile(sourcePath)) {
      throw new Error('Dictionary file must be a .json or .json.zip file');
    }

    if (this.installPromise) {
      await this.installPromise;
      return;
    }

    this.installPromise = this.runInstall(async () => {
      const settings = await getSettings();
      settings.dictionarySourcePath = sourcePath;
      await setSettings(settings);

      await this.buildIndexFromSource(sourcePath);
    });

    try {
      await this.installPromise;
    } finally {
      this.installPromise = null;
    }
  }

  private async runInstall(task: () => Promise<void>): Promise<void> {
    try {
      this.index = null;
      await task();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Dictionary setup failed';
      const settings = await getSettings();
      this.setStatus({
        status: 'error',
        error: message,
        sourcePath: settings.dictionarySourcePath,
      });
      throw error;
    }
  }

  private async buildIndexFromSource(sourcePath: string): Promise<void> {
    this.setStatus({
      status: 'building',
      progress: 0,
      message: 'Building dictionary index (one-time setup)...',
      sourcePath: sourcePath,
    });

    const jsonPath = await resolveDictionaryJsonPath(sourcePath, this.getDictionaryDir());
    const sourceStat = await fs.stat(sourcePath);

    const index = await buildDictionaryIndex(jsonPath, (processed) => {
      this.setStatus({
        status: 'building',
        progress: Math.min(99, Math.floor(processed / 2500)),
        message: `Building dictionary index... (${processed.toLocaleString()} entries)`,
        sourcePath: sourcePath,
      });
    });

    index.meta.sourcePath = sourcePath;
    index.meta.sourceMtimeMs = sourceStat.mtimeMs;

    await writeDictionaryIndex(this.getIndexPath(), index);
    this.index = index;
    this.setStatus({
      status: 'ready',
      sourcePath: sourcePath,
    });
  }

  lookup(query: DictionaryLookupQuery): DictionaryLookupResult[] {
    if (!this.index || this.status.status !== 'ready') {
      return [];
    }
    return lookupInIndex(this.index, query);
  }
}

export const jmdictService = new JmdictService();
