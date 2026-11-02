import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LyricsView from '../components/LyricsView';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useCoverImage } from '../hooks/useCoverImage';
import VolumeControl from '../components/VolumeControl';
import type { SongData } from '../types';
import styles from './SingPage.module.css';

export default function SingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const coverUrl = useCoverImage(song?.coverPath);

  const { currentTime, duration, isPlaying, toggle, seek, setSpeed, setVolume, playbackRate, volume } =
    useAudioPlayer({
      src: song?.audioPath,
    });

  useEffect(() => {
    if (!id) return;
    loadSong();
  }, [id]);

  const loadSong = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await window.electronAPI.readSong(id);
      setSong(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const handleStartWithCountdown = () => {
    setCountdown(3);
  };

  useEffect(() => {
    if (countdown === null) return;

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setCountdown(null);
      seek(0);
      toggle();
    }
  }, [countdown]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Song not found'}</div>
        <button onClick={() => navigate('/library')}>Back to Library</button>
      </div>
    );
  }

  if (!song.timing) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>This song needs to be synced first</div>
        <button onClick={() => navigate(`/editor/${id}`)}>Edit Sync</button>
        <button onClick={() => navigate('/library')}>Back to Library</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.background} aria-hidden="true">
        {coverUrl && <img src={coverUrl} alt="" className={styles.backgroundImage} />}
        <div className={styles.backgroundOverlay} />
      </div>
      {countdown !== null && (
        <div className={styles.countdown}>{countdown || 'GO!'}</div>
      )}

      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/library')} aria-label="Back to library" title="Back to library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>{song.meta.title}</h2>
        <div className={styles.timeDisplay}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className={styles.content}>
        <LyricsView
          song={song}
          currentTimeMs={currentTime}
          mode="learning"
          className="sing-mode"
        />
      </div>

      <div className={styles.controls}>
        {!isPlaying && countdown === null && (
          <button className="primary" onClick={handleStartWithCountdown}>
            Start with Countdown
          </button>
        )}
        <button className={styles.playButton} onClick={toggle}>{isPlaying ? 'Pause' : 'Play'}</button>
        <VolumeControl volume={volume} onChange={setVolume} />
        <div className={styles.speedControls}>
          <button
            className={playbackRate === 0.75 ? 'primary' : ''}
            onClick={() => setSpeed(0.75)}
          >
            0.75x
          </button>
          <button
            className={playbackRate === 1 ? 'primary' : ''}
            onClick={() => setSpeed(1)}
          >
            1x
          </button>
          <button
            className={playbackRate === 1.25 ? 'primary' : ''}
            onClick={() => setSpeed(1.25)}
          >
            1.25x
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
