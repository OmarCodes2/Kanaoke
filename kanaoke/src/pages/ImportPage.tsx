import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './ImportPage.module.css';

export default function ImportPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabParam = searchParams.get('tab') as 'import' | 'create' | null;
  const [activeTab, setActiveTab] = useState<'import' | 'create'>(
    tabParam === 'import' || tabParam === 'create' ? tabParam : 'import'
  );

  // Update active tab when query param changes
  useEffect(() => {
    if (tabParam === 'import' || tabParam === 'create') {
      setActiveTab(tabParam);
      // Scroll to tabs section for clarity when navigating via deep link
      if (tabsRef.current) {
        setTimeout(() => {
          tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [tabParam]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/library')}>← Back to Library</button>
        <h1>Import or Create Song</h1>
      </div>

      <div ref={tabsRef} className={styles.tabs}>
        <button
          className={activeTab === 'import' ? 'primary' : ''}
          onClick={() => setActiveTab('import')}
        >
          Import Existing .osj Folder
        </button>
        <button
          className={activeTab === 'create' ? 'primary' : ''}
          onClick={() => setActiveTab('create')}
        >
          Create New Map
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'import' ? <ImportTab /> : <CreateTab />}
      </div>
    </div>
  );
}

function ImportTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    const folderPath = await window.electronAPI.chooseDirectory();
    if (!folderPath) return;

    setLoading(true);
    setError(null);

    try {
      const id = await window.electronAPI.importSongFolder(folderPath);
      navigate(`/editor/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to import song folder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2>Import Existing .osj Folder</h2>
      <p>Select a folder containing a song map (.osj folder structure)</p>
      {error && <div className={styles.error}>{error}</div>}
      <button
        className="primary"
        onClick={handleImport}
        disabled={loading}
      >
        {loading ? 'Importing...' : 'Choose Folder'}
      </button>
    </div>
  );
}

function CreateTab() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [source, setSource] = useState('');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [lyricsJa, setLyricsJa] = useState('');
  const [lyricsRomaji, setLyricsRomaji] = useState('');
  const [lyricsEn, setLyricsEn] = useState('');

  const handleChooseAudio = async () => {
    const path = await window.electronAPI.chooseFile([
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg'] },
    ]);
    if (path) {
      setAudioPath(path);
    }
  };

  const handleChooseCover = async () => {
    const path = await window.electronAPI.chooseFile([
      { name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] },
    ]);
    if (path) {
      setCoverPath(path);
    }
  };

  const handleCreate = async () => {
    if (!title.trim() || !artist.trim() || !audioPath || !lyricsJa.trim()) {
      setError('Title, Artist, Audio file, and Japanese lyrics are required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const id = await window.electronAPI.createSong({
        title: title.trim(),
        artist: artist.trim(),
        source: source.trim() || undefined,
        audioPath,
        lyricsJa: lyricsJa.trim(),
        lyricsRomaji: lyricsRomaji.trim() || undefined,
        lyricsEn: lyricsEn.trim() || undefined,
        coverPath: coverPath || undefined,
      });
      navigate(`/editor/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create song');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.tabContent}>
      <h2>Create New Song Map</h2>
      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.form}>
        <div className={styles.formGroup}>
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Song title"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Artist *</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Artist name"
          />
        </div>

        <div className={styles.formGroup}>
          <label>Source (optional)</label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="Anime, game, etc."
          />
        </div>

        <div className={styles.formGroup}>
          <label>Audio File *</label>
          <div className={styles.fileInput}>
            <button onClick={handleChooseAudio}>Choose Audio File</button>
            {audioPath && <span className={styles.filePath}>{audioPath}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Cover Image (optional)</label>
          <div className={styles.fileInput}>
            <button onClick={handleChooseCover}>Choose Cover Image</button>
            {coverPath && <span className={styles.filePath}>{coverPath}</span>}
          </div>
        </div>

        <div className={styles.formGroup}>
          <label>Japanese Lyrics * (one line per lyric line)</label>
          <textarea
            value={lyricsJa}
            onChange={(e) => setLyricsJa(e.target.value)}
            placeholder="Paste Japanese lyrics here, one line per lyric line"
            rows={8}
          />
        </div>

        <div className={styles.formGroup}>
          <label>Romaji Lyrics (optional, must match line count)</label>
          <textarea
            value={lyricsRomaji}
            onChange={(e) => setLyricsRomaji(e.target.value)}
            placeholder="Paste Romaji lyrics here"
            rows={8}
          />
        </div>

        <div className={styles.formGroup}>
          <label>English Lyrics (optional, must match line count)</label>
          <textarea
            value={lyricsEn}
            onChange={(e) => setLyricsEn(e.target.value)}
            placeholder="Paste English lyrics here"
            rows={8}
          />
        </div>

        <button className="primary" onClick={handleCreate} disabled={loading}>
          {loading ? 'Creating...' : 'Create Song'}
        </button>
      </div>
    </div>
  );
}











