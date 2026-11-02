import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SongSummary } from '../types';
import VolumeControl from './VolumeControl';
import styles from './SongPreviewPanel.module.css';

interface SongPreviewPanelProps {
  song: SongSummary;
  coverUrl?: string | null;
  onRefresh?: () => void;
  onStopPreview?: () => void;
  previewVolume?: number;
  onPreviewVolumeChange?: (volume: number) => void;
  coverArtImageRef?: React.RefObject<HTMLImageElement>;
}

export default function SongPreviewPanel({
  song,
  coverUrl,
  onRefresh,
  onStopPreview,
  previewVolume,
  onPreviewVolumeChange,
  coverArtImageRef,
}: SongPreviewPanelProps) {
  const navigate = useNavigate();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const handleStart = () => {
    if (song.status !== 'synced') return;
    setShowStartModal(true);
  };

  const handleSync = () => {
    onStopPreview?.();
    navigate(`/editor/${song.id}`);
  };

  const handleLearn = () => {
    if (song.status !== 'synced') return;
    onStopPreview?.();
    setShowStartModal(false);
    navigate(`/learn/${song.id}`);
  };

  const handleSing = () => {
    if (song.status !== 'synced') return;
    onStopPreview?.();
    setShowStartModal(false);
    navigate(`/sing/${song.id}`);
  };

  const handleEditSync = () => {
    setShowMenu(false);
    navigate(`/editor/${song.id}`);
  };

  const handleOpenFolder = async () => {
    setShowMenu(false);
    await window.electronAPI.openInExplorer(song.path);
  };

  const getStatusLabel = (status: SongSummary['status']) => {
    switch (status) {
      case 'synced':
        return 'SYNCED';
      case 'needs-sync':
        return 'NEEDS SYNC';
      case 'missing-lyrics':
        return 'MISSING LYRICS';
      case 'invalid':
        return 'INVALID';
    }
  };

  const getStatusClass = (status: SongSummary['status']) => {
    switch (status) {
      case 'synced':
        return styles.statusSynced;
      case 'needs-sync':
        return styles.statusNeedsSync;
      case 'missing-lyrics':
        return styles.statusMissing;
      case 'invalid':
        return styles.statusInvalid;
    }
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getInitials = (title: string) => {
    return title
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <div className={styles.previewPanel} style={{ position: 'relative', zIndex: 1 }}>
        {/* Hero Image with Parallax */}
        <div className={styles.coverArtContainer}>
          {coverUrl ? (
            <img
              ref={coverArtImageRef}
              src={coverUrl}
              alt={song.title}
              className={styles.coverArt}
              draggable={false}
              onLoad={() => {
              }}
              onError={(e) => {
                console.error('Failed to load cover image:', coverUrl, e);
                e.currentTarget.style.display = 'none';
                const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'block';
                }
              }}
            />
          ) : null}
          <div
            className={styles.coverPlaceholder}
            style={{ display: coverUrl ? 'none' : 'block' }}
          >
            <div className={styles.placeholderGradient}>
              {getInitials(song.title)}
            </div>
          </div>
          
          {/* Three-Dot Menu */}
          <div className={styles.heroMenuContainer} ref={menuRef}>
            <button
              className={styles.heroMenuButton}
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Menu"
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
            {showMenu && (
              <div className={styles.heroMenu}>
                <button className={styles.heroMenuItem} onClick={handleEditSync}>
                  Edit Sync
                </button>
                <button className={styles.heroMenuItem} onClick={handleOpenFolder}>
                  Open Folder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Centered Content Stack */}
        <div className={styles.contentStack}>
          <h1 className={styles.title}>{song.title}</h1>
          
          <div className={styles.metadata}>
            <span className={styles.artist}>{song.artist}</span>
            <span className={styles.metadataSeparator}>·</span>
            <span className={styles.duration}>{formatDuration(song.durationSec)}</span>
            <span className={styles.metadataSeparator}>·</span>
            <span className={`${styles.statusBadge} ${getStatusClass(song.status)}`}>
              ✔ {getStatusLabel(song.status)}
            </span>
          </div>

          {song.status === 'synced' ? (
            <button 
              className={styles.startButton} 
              onClick={handleStart}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Start
            </button>
          ) : (
            <button 
              className={styles.syncButton} 
              onClick={handleSync}
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              Sync
            </button>
          )}
        </div>
        {previewVolume !== undefined && onPreviewVolumeChange && (
          <VolumeControl
            className={styles.previewVolumeControl}
            volume={previewVolume}
            onChange={onPreviewVolumeChange}
          />
        )}
      </div>

      {/* Start Modal */}
      {showStartModal && (
        <div className={styles.modalOverlay} onClick={() => setShowStartModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>How do you want to start?</h2>
            <div className={styles.modalOptions}>
              <button className={styles.modalOption} onClick={handleLearn}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 1-3-3V7a4 4 0 0 0-4-4z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 0 3 3h7V7a4 4 0 0 1-4-4z" />
                </svg>
                <span>Learn</span>
              </button>
              <button className={styles.modalOption} onClick={handleSing}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <path d="M12 19 L12 23" />
                  <path d="M8 23 L16 23" />
                </svg>
                <span>Sing</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

