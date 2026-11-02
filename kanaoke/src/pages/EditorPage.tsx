import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import VolumeControl from '../components/VolumeControl';
import type { SongData, TimingData, TimingLine } from '../types';
import { validateTimingMonotonic } from '../utils/validation';
import styles from './EditorPage.module.css';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [song, setSong] = useState<SongData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timing, setTiming] = useState<TimingData | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [offsetMs, setOffsetMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);

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
      
      // Validate data structure
      if (!data || !data.meta || !data.lyrics || !Array.isArray(data.lyrics.ja)) {
        throw new Error('Invalid song data structure');
      }

      setSong(data);

      // Initialize timing if it doesn't exist
      if (!data.timing) {
        const newTiming: TimingData = {
          version: 1,
          offsetMs: 0,
          lines: data.lyrics.ja.map((_: string, index: number) => ({
            index,
            startMs: 0,
          })),
        };
        setTiming(newTiming);
      } else {
        // Validate timing structure
        if (!data.timing.lines || !Array.isArray(data.timing.lines)) {
          // Create new timing if existing one is invalid
          const newTiming: TimingData = {
            version: 1,
            offsetMs: data.timing.offsetMs || 0,
            lines: data.lyrics.ja.map((_: string, index: number) => ({
              index,
              startMs: 0,
            })),
          };
          setTiming(newTiming);
          setOffsetMs(newTiming.offsetMs);
        } else {
          setTiming(data.timing);
          setOffsetMs(data.timing.offsetMs || 0);
        }
      }
    } catch (err: any) {
      console.error('Error loading song:', err);
      setError(err.message || 'Failed to load song');
    } finally {
      setLoading(false);
    }
  };

  const validateTiming = useCallback(() => {
    const warningsList: string[] = [];
    if (!timing || !song) return;

    try {
      if (!validateTimingMonotonic(timing)) {
        warningsList.push('Timing is not strictly increasing');
      }

      if (timing.lines.length !== song.lyrics.ja.length) {
        warningsList.push(
          `Timing has ${timing.lines.length} lines but lyrics have ${song.lyrics.ja.length} lines`,
        );
      }
    } catch (err) {
      console.error('Error in validation:', err);
      warningsList.push('Error validating timing data');
    }

    setWarnings(warningsList);
  }, [timing, song]);

  useEffect(() => {
    if (!timing || !song) return;
    try {
      validateTiming();
    } catch (err) {
      console.error('Error validating timing:', err);
      setWarnings(['Error validating timing data']);
    }
  }, [timing, song, validateTiming]);

  const handleStampNext = useCallback(() => {
    if (!timing) return;
    try {
      const roundedTime = Math.round((currentTime - offsetMs) / 10) * 10;
      const newLines = [...timing.lines];
      
      if (selectedIndex < newLines.length) {
        newLines[selectedIndex] = {
          index: selectedIndex,
          startMs: Math.max(0, roundedTime),
        };
        setTiming({ ...timing, lines: newLines });
        
        if (selectedIndex < newLines.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        }
      }
    } catch (err) {
      console.error('Error stamping line:', err);
      setError('Failed to stamp line');
    }
  }, [currentTime, timing, selectedIndex, offsetMs]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleStampNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleStampNext]);

  // Ensure selectedIndex is within bounds - must be before any conditional returns
  useEffect(() => {
    if (song && song.lyrics?.ja && song.lyrics.ja.length > 0) {
      const maxIndex = song.lyrics.ja.length - 1;
      if (selectedIndex > maxIndex || selectedIndex < 0) {
        setSelectedIndex(Math.max(0, Math.min(selectedIndex, maxIndex)));
      }
    }
  }, [song, selectedIndex]);

  const handleUndo = () => {
    if (!timing || selectedIndex === 0) return;
    const newLines = [...timing.lines];
    newLines[selectedIndex - 1] = {
      index: selectedIndex - 1,
      startMs: 0,
    };
    setTiming({ ...timing, lines: newLines });
    setSelectedIndex(Math.max(0, selectedIndex - 1));
  };

  const handleNudge = (ms: number) => {
    if (!timing || selectedIndex >= timing.lines.length) return;
    const newLines = [...timing.lines];
    newLines[selectedIndex] = {
      ...newLines[selectedIndex],
      startMs: Math.max(0, newLines[selectedIndex].startMs + ms),
    };
    setTiming({ ...timing, lines: newLines });
  };

  const handleJumpToLine = (index: number) => {
    if (!timing || index < 0 || index >= timing.lines.length) return;
    setSelectedIndex(index);
    const lineStart = timing.lines[index].startMs + offsetMs;
    seek(lineStart);
  };

  const handleSave = async () => {
    if (!timing || !id) return;
    setSaving(true);
    try {
      await window.electronAPI.saveTiming(id, timing);
      navigate('/library');
    } catch (err: any) {
      setError(err.message || 'Failed to save timing');
    } finally {
      setSaving(false);
    }
  };

  const handleOffsetChange = (newOffset: number) => {
    setOffsetMs(newOffset);
    if (timing) {
      setTiming({ ...timing, offsetMs: newOffset });
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (error || !song || !timing) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          {error || 'Song not found'}
          {!song && <div>Song data is missing</div>}
          {!timing && <div>Timing data is missing</div>}
        </div>
        <button onClick={() => navigate('/library')}>Back to Library</button>
      </div>
    );
  }

  // Additional safety checks
  if (!song.lyrics?.ja || !Array.isArray(song.lyrics.ja)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Invalid lyrics data</div>
        <button onClick={() => navigate('/library')}>Back to Library</button>
      </div>
    );
  }

  if (!timing.lines || !Array.isArray(timing.lines)) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Invalid timing data</div>
        <button onClick={() => navigate('/library')}>Back to Library</button>
      </div>
    );
  }

  // Calculate safe selected index for rendering
  const safeSelectedIndex = song && song.lyrics.ja && song.lyrics.ja.length > 0
    ? Math.max(0, Math.min(selectedIndex, song.lyrics.ja.length - 1))
    : 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => navigate('/library')}>← Back</button>
        <h2>Sync Editor: {song.meta?.title || 'Unknown Song'}</h2>
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {warnings.length > 0 && (
        <div className={styles.warnings}>
          {warnings.map((w, i) => (
            <div key={i} className={styles.warning}>{w}</div>
          ))}
        </div>
      )}

      <div className={styles.audioPlayer}>
        <div className={styles.playerControls}>
          <button className={styles.playButton} onClick={toggle}>
            {isPlaying ? '⏸' : '▶'}
          </button>
            <VolumeControl volume={volume} onChange={setVolume} />
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
      </div>

      <div className={styles.content}>
        <div className={styles.leftPanel}>
          <div className={styles.controls}>
            <button onClick={toggle}>{isPlaying ? 'Pause' : 'Play'}</button>
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
            <div className={styles.offsetControl}>
              <label>Offset (ms):</label>
              <input
                type="number"
                value={offsetMs}
                onChange={(e) => handleOffsetChange(Number(e.target.value))}
                style={{ width: '100px' }}
              />
            </div>
          </div>

          <div className={styles.editorActions}>
            <button className="primary" onClick={handleStampNext}>
              Stamp Next Line (Enter)
            </button>
            <button onClick={handleUndo}>Undo Last</button>
            <div className={styles.nudgeControls}>
              <button onClick={() => handleNudge(-500)}>-500ms</button>
              <button onClick={() => handleNudge(-100)}>-100ms</button>
              <button onClick={() => handleNudge(100)}>+100ms</button>
              <button onClick={() => handleNudge(500)}>+500ms</button>
            </div>
          </div>

          <div className={styles.timeDisplay}>
            Current: {formatTime(currentTime)} | Selected Line: {formatTime((timing.lines[safeSelectedIndex]?.startMs ?? 0) + offsetMs)}
          </div>
        </div>

        <div className={styles.rightPanel}>
          <div className={styles.linesList}>
            {song.lyrics.ja.map((line: string, index: number) => {
              const lineTiming = timing.lines[index];
              const isSelected = index === safeSelectedIndex;
              const isStamped = lineTiming && typeof lineTiming.startMs === 'number' && lineTiming.startMs > 0;

              return (
                <div
                  key={index}
                  className={`${styles.lineItem} ${isSelected ? styles.selected : ''} ${
                    isStamped ? styles.stamped : ''
                  }`}
                  onClick={() => {
                    try {
                      handleJumpToLine(index);
                    } catch (err) {
                      console.error('Error jumping to line:', err);
                      setError('Failed to jump to line');
                    }
                  }}
                >
                  <div className={styles.lineNumber}>{index + 1}</div>
                  <div className={styles.lineText}>{line || ''}</div>
                  <div className={styles.lineTime}>
                    {isStamped && lineTiming && typeof lineTiming.startMs === 'number'
                      ? formatTime(lineTiming.startMs + offsetMs)
                      : 'Not stamped'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${Math.floor(milliseconds / 100)}`;
}
