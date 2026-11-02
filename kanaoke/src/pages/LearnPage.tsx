import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import LyricsView, { type LyricsMode } from '../components/LyricsView';
import TokenizedLyrics from '../components/TokenizedLyrics';
import RightTokenPanel from '../components/RightTokenPanel';
import VolumeControl from '../components/VolumeControl';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useCoverImage } from '../hooks/useCoverImage';
import { getActiveLineIndex } from '../utils/timingEngine';
import type { SongData, TokenizedData, DisplayToken } from '../types';
import styles from './LearnPage.module.css';

export default function LearnPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<LyricsMode>('learning');
  const [loopLine, setLoopLine] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [tokenized, setTokenized] = useState<TokenizedData | null>(null);
  const [tokenizing, setTokenizing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<{
    token: DisplayToken;
    lineIndex: number;
  } | null>(null);
  const coverUrl = useCoverImage(song?.coverPath);

  const { currentTime, duration, isPlaying, toggle, seek, setSpeed, setVolume, playbackRate, volume } =
    useAudioPlayer({
      src: song?.audioPath,
    });

  useEffect(() => {
    if (loopLine && loopStart !== null && loopEnd !== null && currentTime >= loopEnd) {
      seek(loopStart);
    }
  }, [currentTime, loopLine, loopStart, loopEnd, seek]);

  useEffect(() => {
    if (!id) return;
    loadSong();
  }, [id]);

  const loadSong = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setTokenized(null);
    setTokenizing(false);
    try {
      const data = await window.electronAPI.readSong(id);
      setSong(data);
      
      setTokenizing(true);
      try {
        const tokenizedData = await window.electronAPI.ensureTokenized(id);
        setTokenized(tokenizedData);
      } catch (err: any) {
        console.error('Failed to load/generate tokenized data:', err);
      } finally {
        setTokenizing(false);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load song');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handlePreviousLine = useCallback(() => {
    if (!song?.timing) return;
    const activeIndex = getActiveLineIndex(currentTime, song.timing);
    if (activeIndex === null || activeIndex === 0) {
      seek(0);
      return;
    }
    const prevStart = song.timing.lines[activeIndex - 1].startMs + song.timing.offsetMs;
    seek(prevStart);
  }, [song, currentTime, seek]);

  const handleNextLine = useCallback(() => {
    if (!song?.timing) return;
    const activeIndex = getActiveLineIndex(currentTime, song.timing);
    if (activeIndex === null) {
      const firstStart = song.timing.lines[0].startMs + song.timing.offsetMs;
      seek(firstStart);
      return;
    }
    if (activeIndex >= song.timing.lines.length - 1) {
      seek(duration);
      return;
    }
    const nextStart = song.timing.lines[activeIndex + 1].startMs + song.timing.offsetMs;
    seek(nextStart);
  }, [song, currentTime, duration, seek]);

  const handleToggleLoop = useCallback(() => {
    if (!song?.timing) return;
    const activeIndex = getActiveLineIndex(currentTime, song.timing);
    if (activeIndex === null) {
      setLoopLine(false);
      return;
    }

    if (loopLine) {
      setLoopLine(false);
      setLoopStart(null);
      setLoopEnd(null);
    } else {
      const line = song.timing.lines[activeIndex];
      const start = line.startMs + song.timing.offsetMs;
      const end =
        activeIndex < song.timing.lines.length - 1
          ? song.timing.lines[activeIndex + 1].startMs + song.timing.offsetMs
          : duration;
      setLoopStart(start);
      setLoopEnd(end);
      setLoopLine(true);
    }
  }, [song, currentTime, duration, loopLine]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggle();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          handlePreviousLine();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          handleNextLine();
          break;
        case 'l':
        case 'L':
          e.preventDefault();
          handleToggleLoop();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePreviousLine, handleNextLine, handleToggleLoop, toggle]);

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
      <div className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate('/library')} aria-label="Back to library" title="Back to library">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>{song.meta.title}</h2>
        <div className={styles.modeSelector}>
          <button
            className={mode === 'immersion' ? 'primary' : ''}
            onClick={() => setMode('immersion')}
          >
            Immersion
          </button>
          <button
            className={mode === 'learning' ? 'primary' : ''}
            onClick={() => setMode('learning')}
          >
            Learning
          </button>
          <button
            className={mode === 'study' ? 'primary' : ''}
            onClick={() => setMode('study')}
          >
            Study
          </button>
        </div>
      </div>

      <div className={styles.audioPlayer}>
        <div className={styles.playerControls}>
          <button className={styles.playButton} onClick={toggle}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <div className={styles.scrubberContainer}>
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              className={styles.scrubber}
              disabled={!duration || duration === 0}
            />
            <div className={styles.timeLabels}>
              <span className={styles.timeLabel}>{formatTime(currentTime)}</span>
              <span className={styles.timeLabel}>{formatTime(duration)}</span>
            </div>
          </div>
        </div>
        <div className={styles.secondaryControls}>
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
          <button
            className={loopLine ? 'primary' : ''}
            onClick={handleToggleLoop}
          >
            Loop Line {loopLine ? '(ON)' : ''}
          </button>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.lyricsContainer}>
          {tokenized && !tokenizing ? (
            <TokenizedLyrics
              song={song}
              tokenized={tokenized}
              currentTimeMs={currentTime}
              mode={mode}
              onTokenClick={(lineIndex, tokenIndex, token) => {
                setSelectedToken({ token, lineIndex });
              }}
              selectedToken={selectedToken?.token ?? null}
            />
          ) : (
            <LyricsView song={song} currentTimeMs={currentTime} mode={mode} />
          )}
        </div>
        <RightTokenPanel
          token={selectedToken?.token ?? null}
          sentence={selectedToken ? song.lyrics.ja[selectedToken.lineIndex] || '' : ''}
          sentenceTranslation={selectedToken ? song.lyrics.en?.[selectedToken.lineIndex] || '' : ''}
          songId={song.meta.id}
          songTitle={song.meta.title}
        />
      </div>

      <div className={styles.hotkeys}>
        <div>Space: Play/Pause | J/K: Previous/Next Line | L: Toggle Loop</div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}




