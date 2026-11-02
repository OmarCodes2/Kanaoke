import { useEffect, useRef, useCallback, useState } from 'react';
import type { SongSummary } from '../types';

const PREVIEW_VOLUME = 0.35;
const FADE_OUT_DURATION = 120; // ms
const FADE_IN_DURATION = 180; // ms
const DEBOUNCE_DELAY = 80; // ms - reduced for faster response
const PREVIEW_START_DEFAULT = 15; // seconds

interface UseSongPreviewOptions {
  selectedSong: SongSummary | null;
  isPreviewEnabled?: boolean;
  onError?: (error: Error) => void;
}

export function useSongPreview({
  selectedSong,
  isPreviewEnabled = true,
  onError,
}: UseSongPreviewOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  const fadeIntervalRef = useRef<number | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const pendingSongIdRef = useRef<string | null>(null);
  const isFadingOutRef = useRef(false);
  const previewStartTimeRef = useRef<number>(PREVIEW_START_DEFAULT);
  const endedHandlerRef = useRef<(() => void) | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(PREVIEW_VOLUME);
  const volumeRef = useRef(PREVIEW_VOLUME);

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume));

    if (clampedVolume === volumeRef.current) {
      return;
    }

    volumeRef.current = clampedVolume;
    if (fadeIntervalRef.current !== null) {
      clearTimeout(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
      isFadingOutRef.current = false;
    }
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    setVolumeState(clampedVolume);
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = 0;
      audioRef.current.preload = 'auto';
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.muted = false;
    }

    return () => {
      currentSongIdRef.current = null;
      pendingSongIdRef.current = null;
      isFadingOutRef.current = false;

      if (audioRef.current) {
        if (endedHandlerRef.current) {
          audioRef.current.removeEventListener('ended', endedHandlerRef.current);
          endedHandlerRef.current = null;
        }
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (fadeIntervalRef.current !== null) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }
    };
  }, []);

  const stopPreview = useCallback((immediate = false) => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (fadeIntervalRef.current !== null) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }

    if (!audioRef.current) return;

    // Remove loop handler when stopping
    if (endedHandlerRef.current && audioRef.current) {
      audioRef.current.removeEventListener('ended', endedHandlerRef.current);
      endedHandlerRef.current = null;
    }

    if (immediate) {
      audioRef.current.pause();
      audioRef.current.volume = 0;
      isFadingOutRef.current = false;
      setIsPlaying(false);
    } else {
      isFadingOutRef.current = true;
      const startVolume = audioRef.current.volume;
      const startTime = Date.now();
      const duration = FADE_OUT_DURATION;

      const fadeOut = () => {
        if (!audioRef.current || !isFadingOutRef.current) return;

        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const newVolume = startVolume * (1 - progress);

        audioRef.current.volume = newVolume;

        if (progress < 1) {
          fadeIntervalRef.current = window.setTimeout(fadeOut, 16);
        } else {
          audioRef.current.pause();
          audioRef.current.volume = 0;
          isFadingOutRef.current = false;
          fadeIntervalRef.current = null;
          setIsPlaying(false);
        }
      };

      fadeOut();
    }
  }, []);

  const startPreview = useCallback(
    async (song: SongSummary) => {
      if (!audioRef.current || !isPreviewEnabled) return;

      if (fadeIntervalRef.current !== null) {
        clearInterval(fadeIntervalRef.current);
        fadeIntervalRef.current = null;
      }

      isFadingOutRef.current = false;

      try {
        const audioPath = await window.electronAPI.getSongAudioPath(song.id);
        if (!audioPath) {
          throw new Error(`No audio file found for song: ${song.id}`);
        }

        // Use file:// URL directly - much faster than blob URL conversion
        let fileUrl = audioPath.replace(/\\/g, '/');
        const pathParts = fileUrl.split('/');
        const encodedParts = pathParts.map((part, index) => {
          if (index === 0 && part.match(/^[A-Za-z]:$/)) {
            return part;
          }
          return encodeURIComponent(part);
        });
        fileUrl = encodedParts.join('/');
        
        if (fileUrl.match(/^[A-Za-z]:\//)) {
          fileUrl = 'file:///' + fileUrl;
        } else if (fileUrl.startsWith('/')) {
          fileUrl = 'file://' + fileUrl;
        } else {
          fileUrl = 'file:///' + fileUrl;
        }
        
        const audioUrl = fileUrl;

        // Clear previous source without delay
        if (audioRef.current.src) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        audioRef.current.src = audioUrl;
        audioRef.current.volume = 0;

        let previewStartSec = PREVIEW_START_DEFAULT;
        if (song.durationSec) {
          previewStartSec = Math.max(0, Math.min(PREVIEW_START_DEFAULT, song.durationSec - 10));
        }

        let metadataLoaded = false;
        await new Promise<void>((resolve, reject) => {
          if (!audioRef.current) {
            reject(new Error('Audio element not available'));
            return;
          }

          const audio = audioRef.current;
          let resolved = false;

          const handleLoadedMetadata = () => {
            metadataLoaded = true;
          };

          const handleCanPlay = () => {
            if (resolved) return;
            if (!metadataLoaded) return;
            resolved = true;
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            resolve();
          };

          const handleCanPlayThrough = () => {
            if (resolved) return;
            if (!metadataLoaded) return;
            resolved = true;
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            resolve();
          };

          const handleError = (e: Event) => {
            if (resolved) return;
            resolved = true;
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('canplaythrough', handleCanPlayThrough);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            reject(new Error(`Failed to load audio: ${(audio as HTMLAudioElement).error?.message || 'Unknown error'}`));
          };

          audio.addEventListener('canplay', handleCanPlay);
          audio.addEventListener('canplaythrough', handleCanPlayThrough);
          audio.addEventListener('loadedmetadata', handleLoadedMetadata);
          audio.addEventListener('error', handleError);

          const loadPromise = audio.load();
          if (loadPromise) {
            loadPromise.catch(() => {
              // Ignore load promise errors, we handle via error event
            });
          }

          setTimeout(() => {
            if (!resolved) {
              resolved = true;
              audio.removeEventListener('canplay', handleCanPlay);
              audio.removeEventListener('canplaythrough', handleCanPlayThrough);
              audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
              audio.removeEventListener('error', handleError);
              reject(new Error('Audio load timeout'));
            }
          }, 10000);
        });

        if (!audioRef.current || currentSongIdRef.current !== song.id) {
          return;
        }

        // Wait for metadata if needed, but don't block if it's already loading
        if (audioRef.current.readyState < 2) {
          // Try to wait for metadata, but with a shorter timeout
          await new Promise<void>((resolve) => {
            let attempts = 0;
            const maxAttempts = 20; // 2 seconds max
            const checkReady = () => {
              if (audioRef.current && audioRef.current.readyState >= 2) {
                resolve();
              } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkReady, 100);
              } else {
                // Timeout - proceed anyway, might still work
                resolve();
              }
            };
            checkReady();
          });
        }

        try {
          if (audioRef.current.duration && previewStartSec >= audioRef.current.duration) {
            audioRef.current.currentTime = 0;
          } else {
            audioRef.current.currentTime = previewStartSec;
          }
        } catch (err) {
          // Continue anyway
        }

        try {
          const playPromise = audioRef.current.play();
          if (playPromise) {
            await playPromise;
            setIsPlaying(true);
          } else {
            setIsPlaying(true);
          }
        } catch (err: any) {
          setIsPlaying(false);
          throw err;
        }

        const startTime = Date.now();
        const duration = FADE_IN_DURATION;

        const fadeIn = () => {
          if (!audioRef.current || currentSongIdRef.current !== song.id) {
            return;
          }

          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const newVolume = volumeRef.current * progress;

          audioRef.current.volume = newVolume;

          if (progress < 1) {
            fadeIntervalRef.current = window.setTimeout(fadeIn, 16);
          } else {
            audioRef.current.volume = volumeRef.current;
            fadeIntervalRef.current = null;
          }
        };

        fadeIn();

        // Set up loop handler - restart from preview start when song ends
        if (endedHandlerRef.current && audioRef.current) {
          audioRef.current.removeEventListener('ended', endedHandlerRef.current);
        }
        
        endedHandlerRef.current = () => {
          if (!audioRef.current || currentSongIdRef.current !== song.id) {
            return;
          }
          
          // Loop back to preview start time
          try {
            audioRef.current.currentTime = previewStartTimeRef.current;
            audioRef.current.play().catch(() => {
              // Ignore play errors on loop
            });
          } catch (err) {
            // Ignore seek errors
          }
        };
        
        if (audioRef.current) {
          audioRef.current.addEventListener('ended', endedHandlerRef.current);
        }
      } catch (error) {
        if (onError) {
          onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    },
    [isPreviewEnabled, onError, stopPreview],
  );

  const stopPreviewRef = useRef(stopPreview);
  const startPreviewRef = useRef(startPreview);
  
  useEffect(() => {
    stopPreviewRef.current = stopPreview;
    startPreviewRef.current = startPreview;
  }, [stopPreview, startPreview]);

  useEffect(() => {
    if (!isPreviewEnabled) {
      stopPreviewRef.current(true);
      currentSongIdRef.current = null;
      return;
    }

    if (!selectedSong) {
      stopPreviewRef.current();
      currentSongIdRef.current = null;
      return;
    }

    if (currentSongIdRef.current === selectedSong.id) {
      return;
    }

    stopPreviewRef.current();

    const targetSongId = selectedSong.id;
    currentSongIdRef.current = targetSongId;
    const targetSong = selectedSong;

    if (debounceTimerRef.current !== null) {
      if (pendingSongIdRef.current !== targetSongId) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        pendingSongIdRef.current = null;
      } else {
        return;
      }
    }
    
    pendingSongIdRef.current = targetSongId;
    
    debounceTimerRef.current = window.setTimeout(() => {
      pendingSongIdRef.current = null;
      
      if (currentSongIdRef.current === targetSongId && audioRef.current) {
        startPreviewRef.current(targetSong);
      }
      debounceTimerRef.current = null;
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current !== null && pendingSongIdRef.current !== targetSongId) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
        pendingSongIdRef.current = null;
      }
    };
  }, [selectedSong?.id, isPreviewEnabled]);

  // Track playing state via audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Check initial state
    setIsPlaying(!audio.paused && audio.readyState >= 2);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [selectedSong?.id]);

  return {
    stopPreview,
    setVolume,
    isPlaying,
    volume,
  };
}
