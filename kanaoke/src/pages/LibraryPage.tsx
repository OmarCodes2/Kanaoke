import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SongSummary, AppSettings } from '../types';
import SongListItem from '../components/SongListItem';
import SongPreviewPanel from '../components/SongPreviewPanel';
import { getCoverArtPath } from '../utils/coverArt';
import { useCoverImage } from '../hooks/useCoverImage';
import { useSongPreview } from '../hooks/useSongPreview';
import { useParallax } from '../hooks/useParallax';
import { useDictionaryStatus } from '../hooks/useDictionaryStatus';
import DictionarySetup from '../components/DictionarySetup';
import styles from './LibraryPage.module.css';

const LAST_SELECTED_SONG_ID_KEY = 'kanaoke:lastSelectedSongId';
let cachedSettings: AppSettings | null = null;
let cachedSongs: SongSummary[] = [];
let cachedSelectedSongId: string | null = null;

function getInitialSelectedSong(): SongSummary | null {
  if (cachedSongs.length === 0) return null;

  const selectedId = cachedSelectedSongId
    || localStorage.getItem(LAST_SELECTED_SONG_ID_KEY);
  return cachedSongs.find((song) => song.id === selectedId) || cachedSongs[0];
}

export default function LibraryPage() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<SongSummary[]>(cachedSongs);
  const [selectedSong, setSelectedSong] = useState<SongSummary | null>(getInitialSelectedSong);
  const [settings, setSettings] = useState<AppSettings | null>(cachedSettings);
  const [loading, setLoading] = useState(cachedSongs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [backgroundImageLoaded, setBackgroundImageLoaded] = useState(false);
  const previewStopRef = useRef<(() => void) | null>(null);
  const coverArtImageRef = useRef<HTMLImageElement>(null);
  const songListRef = useRef<HTMLDivElement>(null);
  const dictionaryStatus = useDictionaryStatus();
  const [showDictionaryPanel, setShowDictionaryPanel] = useState(false);

  useEffect(() => {
    if (!settings) loadSettings();
  }, []);

  useEffect(() => {
    if (settings) {
      scanLibrary();
    }
  }, [settings]);

  // Initialize preview hook
  const { stopPreview, setVolume: setPreviewVolume, volume: previewVolume } = useSongPreview({
    selectedSong,
    isPreviewEnabled: true,
    onError: (error) => {
      console.error('Preview error:', error);
    },
  });

  // Store stopPreview function for use in SongPreviewPanel
  useEffect(() => {
    previewStopRef.current = stopPreview;
  }, [stopPreview]);

  // Get cover art path for selected song
  const selectedCoverPath = useMemo(() => {
    if (!selectedSong) return null;
    return getCoverArtPath(selectedSong.path, selectedSong.coverPath);
  }, [selectedSong]);

  // Load cover image via IPC
  const selectedCoverUrl = useCoverImage(selectedCoverPath);

  useEffect(() => {
    if (selectedCoverUrl) {
      setBackgroundImageLoaded(false); // Reset when URL changes
    }
  }, [selectedCoverUrl]);

  // Parallax effect for the large cover art image (above Learn/Sing buttons)
  useParallax(coverArtImageRef, {
    maxPx: 6.75, // Reduced by 25% from 9px for more subtle movement
    lerpFactor: 0.1,
    scrollContainerRef: songListRef,
    scrollCoupling: 0.3,
    scale: 1.1,
    enabled: !!selectedCoverUrl,
  });

  const loadSettings = async () => {
    try {
      const s = await window.electronAPI.getSettings();
      cachedSettings = s;
      setSettings(s);
    } catch (err) {
      setError('Failed to load settings');
      console.error(err);
    }
  };

  const scanLibrary = async () => {
    if (!settings) return;
    if (cachedSongs.length === 0) setLoading(true);
    setError(null);
    try {
      const results = await window.electronAPI.scanLibrary(settings.libraryPath);
      cachedSongs = results;
      setSongs(results);

      // Keep the current selection while replacing it with the freshly scanned summary.
      setSelectedSong((currentSong) => {
        if (results.length === 0) {
          cachedSelectedSongId = null;
          return null;
        }

        const selectedId = currentSong?.id
          || cachedSelectedSongId
          || localStorage.getItem(LAST_SELECTED_SONG_ID_KEY);
        const nextSong = results.find((song) => song.id === selectedId) || results[0];
        cachedSelectedSongId = nextSong.id;
        return nextSong;
      });
    } catch (err) {
      setError('Failed to scan library');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSetLibraryPath = async () => {
    const path = await window.electronAPI.chooseDirectory();
    if (path) {
      await window.electronAPI.setLibraryPath(path);
      cachedSongs = [];
      cachedSelectedSongId = null;
      setSongs([]);
      setSelectedSong(null);
      setLoading(true);
      await loadSettings();
    }
  };


  // Persist selectedSongId to localStorage
  useEffect(() => {
    if (selectedSong) {
      cachedSelectedSongId = selectedSong.id;
      localStorage.setItem(LAST_SELECTED_SONG_ID_KEY, selectedSong.id);
    }
  }, [selectedSong]);


  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (songs.length === 0) return;

      let newIndex = -1;
      const currentIndex = selectedSong
        ? songs.findIndex((s) => s.id === selectedSong.id)
        : -1;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();

        if (e.key === 'ArrowUp') {
          newIndex =
            currentIndex <= 0
              ? songs.length - 1
              : currentIndex - 1;
        } else {
          newIndex =
            currentIndex >= songs.length - 1
              ? 0
              : currentIndex + 1;
        }

        if (newIndex >= 0 && newIndex < songs.length) {
          setSelectedSong(songs[newIndex]);
        }
      } else if (e.key === 'Enter' && selectedSong) {
        // Enter to learn (if synced)
        if (selectedSong.status === 'synced') {
          e.preventDefault();
          navigate(`/learn/${selectedSong.id}`);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [songs, selectedSong, navigate]);

  return (
    <div className={styles.container}>
      {/* Main content */}
      <div className={styles.content}>
        {/* Left panel - Preview */}
        <div className={styles.preview}>
          {/* osu!-style Background with parallax effect */}
          <div className={styles.background}>
            {selectedCoverUrl ? (
              <div 
                className={styles.backgroundImageContainer}
              >
                <img
                  src={selectedCoverUrl}
                  alt=""
                  className={styles.backgroundImage}
                  onLoad={() => {
                    setBackgroundImageLoaded(true);
                  }}
                  onError={(e) => {
                    console.error('Background image failed to load:', e);
                    setBackgroundImageLoaded(false);
                  }}
                  style={{ opacity: backgroundImageLoaded ? 1 : 0 }}
                />
                <div className={styles.backgroundOverlay} />
              </div>
            ) : null}
            <div
              className={styles.backgroundGradient}
              style={{ opacity: selectedCoverUrl && backgroundImageLoaded ? 0 : 1 }}
            />
          </div>

          {selectedSong ? (
            <SongPreviewPanel
              song={selectedSong}
              coverUrl={selectedCoverUrl}
              onRefresh={scanLibrary}
              onStopPreview={() => previewStopRef.current?.()}
              previewVolume={previewVolume}
              onPreviewVolumeChange={setPreviewVolume}
              coverArtImageRef={coverArtImageRef}
            />
          ) : (
            <div className={styles.noSelection}>
              <div className={styles.noSelectionContent}>
                <h2>Select a song</h2>
                <p>Choose a song from the list to view details</p>
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar - Song list */}
        <div className={styles.sidebar}>
          {/* Header with kanaoke title and action icons */}
          <div className={styles.header}>
            <div className={styles.appTitle}>
              <img src="/kanaoke.png" alt="Kanaoke" className={styles.logo} />
            </div>
            <div className={styles.headerActions}>
              <button
                className={`${styles.iconButton} ${dictionaryStatus.status === 'ready' ? styles.iconButtonActive : ''}`}
                onClick={() => setShowDictionaryPanel((open) => !open)}
                aria-label="Dictionary settings"
                title="Dictionary settings"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  <path d="M8 7h8" />
                  <path d="M8 11h6" />
                </svg>
              </button>
              <button
                className={styles.iconButton}
                onClick={handleSetLibraryPath}
                aria-label="Change library path"
                title="Change library path"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.586a1 1 0 0 1-.707-.293l-4.414-4.414A1 1 0 0 0 6.586 1H4a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2z" />
                  <path d="M12 11v6" />
                  <path d="M9 14l3-3 3 3" />
                </svg>
              </button>
              <button
                className={styles.iconButton}
                onClick={() => navigate('/import?tab=import')}
                aria-label="Import songs"
                title="Import songs"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>
              <button
                className={styles.iconButton}
                onClick={() => navigate('/import?tab=create')}
                aria-label="Add map"
                title="Add map"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          {showDictionaryPanel && (
            <div className={styles.dictionaryPanel}>
              <DictionarySetup status={dictionaryStatus} />
            </div>
          )}

          <div ref={songListRef} className={styles.songList}>
            {loading ? (
              <div className={styles.loading}>Loading...</div>
            ) : songs.length === 0 ? (
              <div className={styles.empty}>
                No songs found. Click "Import/Create" to add songs.
              </div>
            ) : (
              songs.map((song) => {
                const coverPath = getCoverArtPath(song.path, song.coverPath);
                return (
                  <SongListItem
                    key={song.id}
                    song={song}
                    isSelected={selectedSong?.id === song.id}
                    onClick={() => setSelectedSong(song)}
                    coverPath={coverPath}
                  />
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
