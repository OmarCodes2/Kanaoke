import { useEffect, useRef, useState, useCallback } from 'react';

export interface UseAudioPlayerOptions {
  src?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onEnded?: () => void;
}

export function useAudioPlayer(options: UseAudioPlayerOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolumeState] = useState(1);
  const volumeRef = useRef(1);

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume));

    if (clampedVolume === volumeRef.current) {
      return;
    }

    volumeRef.current = clampedVolume;
    if (audioRef.current) {
      audioRef.current.volume = clampedVolume;
    }
    setVolumeState(clampedVolume);
  }, []);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = volumeRef.current;

    const handleTimeUpdate = () => {
      const time = audio.currentTime;
      setCurrentTime(time);
      options.onTimeUpdate?.(time * 1000); // Convert to ms
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      options.onEnded?.();
    };

    const handleError = (e: Event) => {
      console.error('Audio loading error:', e);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audio.src = '';
    };
  }, [options.onTimeUpdate, options.onEnded]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }
    
    if (options.src) {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      
      const handleLoadStart = () => {};
        
      const handleLoadedMetadata = () => {};
        
      const handleLoadedData = () => {};
        
      const handleCanPlay = () => {};
        
      const handleCanPlayThrough = () => {};
        
      const handleError = (e: Event) => {
        console.error('Audio error event:', e);
        if (audio.error) {
          console.error('Error code:', audio.error.code);
          console.error('Error message:', audio.error.message);
        }
      };
        
      const handlePlay = () => {};
        
      const handlePlaying = () => {};
        
      const handlePause = () => {};
        
      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('loadeddata', handleLoadedData);
      audio.addEventListener('canplay', handleCanPlay);
      audio.addEventListener('canplaythrough', handleCanPlayThrough);
      audio.addEventListener('error', handleError);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('playing', handlePlaying);
      audio.addEventListener('pause', handlePause);
      
      try {
        let audioSrc = options.src;
        
        if (audioSrc && !audioSrc.startsWith('http://') && !audioSrc.startsWith('https://') && !audioSrc.startsWith('data:') && !audioSrc.startsWith('blob:') && !audioSrc.startsWith('file://') && !audioSrc.startsWith('kanaoke://')) {
          if (window.electronAPI?.getAudioBlobUrl) {
            window.electronAPI.getAudioBlobUrl(audioSrc)
              .then((url) => {
                if (audio && audioRef.current === audio) {
                  audio.src = url;
                  audio.load();
                }
              })
              .catch(() => {
                setFileUrl(audio, audioSrc);
              });
          } else {
            setFileUrl(audio, audioSrc);
          }
        } else {
          audio.src = audioSrc;
          audio.load();
        }
        
        function setFileUrl(audioEl: HTMLAudioElement, filePath: string) {
          let fileUrl = filePath.replace(/\\/g, '/');
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
          
          audioEl.src = fileUrl;
          audioEl.load();
        }
      } catch (err) {
        console.error('Exception in audio setup:', err);
      }
      
      return () => {
        if (audio) {
          audio.removeEventListener('loadstart', handleLoadStart);
          audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audio.removeEventListener('loadeddata', handleLoadedData);
          audio.removeEventListener('canplay', handleCanPlay);
          audio.removeEventListener('canplaythrough', handleCanPlayThrough);
          audio.removeEventListener('error', handleError);
          audio.removeEventListener('play', handlePlay);
          audio.removeEventListener('playing', handlePlaying);
          audio.removeEventListener('pause', handlePause);
          audio.src = '';
        }
      };
    } else {
      audioRef.current.src = '';
    }
  }, [options.src]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    
    if (audio.error) {
      console.error('Audio has error, cannot play:', {
        code: audio.error.code,
        message: audio.error.message,
      });
      setIsPlaying(false);
      return;
    }
    
    if (audio.readyState < 2) {
      const waitForReady = () => {
        if (audio.readyState >= 2) {
          audio.removeEventListener('canplay', waitForReady);
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                setIsPlaying(true);
              })
              .catch((err) => {
                console.error('Failed to play audio after ready:', err);
                setIsPlaying(false);
              });
          }
        }
      };
      
      audio.addEventListener('canplay', waitForReady);
      return;
    }
    
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Audio play() promise rejected:', err);
          setIsPlaying(false);
        });
    } else {
      setIsPlaying(true);
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback((timeMs: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeMs / 1000;
      setCurrentTime(timeMs / 1000);
    }
  }, []);

  const setSpeed = useCallback((rate: number) => {
    setPlaybackRate(rate);
  }, []);

  return {
    play,
    pause,
    toggle,
    seek,
    setSpeed,
    setVolume,
    isPlaying,
    currentTime: currentTime * 1000,
    duration: duration * 1000,
    playbackRate,
    volume,
  };
}
