import { useEffect, useRef } from 'react';
import type { SongData } from '../types';
import { getActiveLineIndex } from '../utils/timingEngine';
import styles from './LyricsView.module.css';

export type LyricsMode = 'immersion' | 'learning' | 'study';

interface LyricsViewProps {
  song: SongData;
  currentTimeMs: number;
  mode: LyricsMode;
  className?: string;
}

export default function LyricsView({
  song,
  currentTimeMs,
  mode,
  className = '',
}: LyricsViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const activeIndex =
    song.timing && song.timing.lines.length > 0
      ? getActiveLineIndex(currentTimeMs, song.timing)
      : null;

  // Auto-scroll to keep active line always centered in the middle of the screen
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && activeIndex !== null) {
      const container = containerRef.current;
      
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (!activeLineRef.current || !containerRef.current) return;
        
        const containerHeight = container.clientHeight;
        const line = activeLineRef.current;
        
        // Calculate line position relative to container's scroll position
        const lineTop = line.offsetTop;
        const lineHeight = line.offsetHeight;

        // Calculate the exact scroll position to center the line vertically
        // We want the center of the line to be at the center of the viewport
        const lineCenter = lineTop + lineHeight / 2;
        const viewportCenter = containerHeight / 2;
        const targetScroll = lineCenter - viewportCenter;
        
        // Only scroll if we're not already centered (with a small threshold to avoid constant micro-adjustments)
        const currentScroll = container.scrollTop;
        const scrollDifference = Math.abs(currentScroll - targetScroll);
        
        if (scrollDifference > 10) { // 10px threshold to prevent jitter
          container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
        }
      });
    }
  }, [activeIndex, currentTimeMs]); // Trigger on both activeIndex and currentTimeMs to keep it centered as song plays

  const renderLine = (index: number) => {
    const isActive = activeIndex === index;
    const ja = song.lyrics.ja[index] || '';
    const romaji = song.lyrics.romaji?.[index];
    const en = song.lyrics.en?.[index];

    return (
      <div
        key={index}
        ref={isActive ? activeLineRef : null}
        className={`${styles.lyricsLine} ${isActive ? styles.active : ''}`}
      >
        <div className={styles.lyricsJa}>{ja}</div>
        {(mode === 'learning' || mode === 'study') && romaji && (
          <div className={styles.lyricsRomaji}>{romaji}</div>
        )}
        {mode === 'study' && en && <div className={styles.lyricsEn}>{en}</div>}
      </div>
    );
  };

  const containerClass = `${styles.lyricsView} ${className} ${
    className.includes('sing') ? styles.singMode : ''
  }`.trim();

  return (
    <div ref={containerRef} className={containerClass}>
      {song.lyrics.ja.map((_, index) => renderLine(index))}
    </div>
  );
}

