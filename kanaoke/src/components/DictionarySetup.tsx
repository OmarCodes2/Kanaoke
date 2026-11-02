import { useState } from 'react';
import type { DictionaryStatus } from '../types';
import styles from './DictionarySetup.module.css';

interface DictionarySetupProps {
  status: DictionaryStatus;
  compact?: boolean;
}

function getFileName(filePath: string): string {
  const parts = filePath.split(/[/\\]/);
  return parts[parts.length - 1] || filePath;
}

export default function DictionarySetup({ status, compact = false }: DictionarySetupProps) {
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const runAction = async (action: () => Promise<void>) => {
    setBusy(true);
    setLocalError(null);
    try {
      await action();
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Dictionary setup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => runAction(() => window.electronAPI.downloadDictionary());
  const handleChooseFile = () =>
    runAction(async () => {
      await window.electronAPI.chooseDictionaryFile();
    });
  const handleBuildFromSavedPath = () => {
    if (!status.sourcePath) {
      return;
    }
    runAction(() => window.electronAPI.installDictionaryFromPath(status.sourcePath!));
  };

  if (status.status === 'downloading' || status.status === 'building') {
    return (
      <div className={styles.container}>
        <div className={styles.message}>
          {status.message || 'Preparing dictionary...'}
          {typeof status.progress === 'number' ? ` (${status.progress}%)` : ''}
        </div>
      </div>
    );
  }

  const errorMessage = localError || (status.status === 'error' ? status.error : null);

  return (
    <div className={`${styles.container} ${compact ? styles.compact : ''}`}>
      <p className={styles.message}>
        {status.message ||
          'Download JMdict or choose a local dictionary file to enable word meanings.'}
      </p>

      {status.sourcePath && (
        <p className={styles.sourcePath} title={status.sourcePath}>
          Selected: {getFileName(status.sourcePath)}
        </p>
      )}

      {errorMessage && <p className={styles.error}>{errorMessage}</p>}

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          onClick={handleDownload}
          disabled={busy}
        >
          Download dictionary
        </button>
        <button
          className={styles.secondaryButton}
          onClick={handleChooseFile}
          disabled={busy}
        >
          Choose local file...
        </button>
        {status.sourcePath && status.status !== 'ready' && (
          <button
            className={styles.secondaryButton}
            onClick={handleBuildFromSavedPath}
            disabled={busy}
          >
            Build index from selected file
          </button>
        )}
      </div>

      {!compact && (
        <p className={styles.hint}>
          Accepts JMdict English `.json` or `.json.zip` files from{' '}
          <a
            href="https://github.com/scriptin/jmdict-simplified/releases"
            target="_blank"
            rel="noreferrer"
          >
            jmdict-simplified releases
          </a>
          .
        </p>
      )}
    </div>
  );
}
