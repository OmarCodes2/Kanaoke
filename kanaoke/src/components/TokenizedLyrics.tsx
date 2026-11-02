import { useEffect, useRef } from 'react';
import type { SongData, TokenizedData, DisplayToken } from '../types';
import { getActiveLineIndex } from '../utils/timingEngine';
import { buildDisplayTokens } from '../utils/displayTokens';
import styles from './TokenizedLyrics.module.css';

export type LyricsMode = 'immersion' | 'learning' | 'study';

interface TokenizedLyricsProps {
  song: SongData;
  tokenized: TokenizedData;
  currentTimeMs: number;
  mode: LyricsMode;
  onTokenClick: (lineIndex: number, tokenIndex: number, token: DisplayToken) => void;
  selectedToken: DisplayToken | null;
  className?: string;
}

export default function TokenizedLyrics({
  song,
  tokenized,
  currentTimeMs,
  mode,
  onTokenClick,
  selectedToken,
  className = '',
}: TokenizedLyricsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  const activeIndex =
    song.timing && song.timing.lines.length > 0
      ? getActiveLineIndex(currentTimeMs, song.timing)
      : null;

  // Auto-scroll to keep active line centered
  useEffect(() => {
    if (activeLineRef.current && containerRef.current && activeIndex !== null) {
      const container = containerRef.current;
      
      requestAnimationFrame(() => {
        if (!activeLineRef.current || !containerRef.current) return;
        
        const containerHeight = container.clientHeight;
        const line = activeLineRef.current;
        
        const lineTop = line.offsetTop;
        const lineHeight = line.offsetHeight;
        const lineCenter = lineTop + lineHeight / 2;
        const viewportCenter = containerHeight / 2;
        const targetScroll = lineCenter - viewportCenter;
        
        const currentScroll = container.scrollTop;
        const scrollDifference = Math.abs(currentScroll - targetScroll);
        
        if (scrollDifference > 10) {
          container.scrollTo({
            top: Math.max(0, targetScroll),
            behavior: 'smooth',
          });
        }
      });
    }
  }, [activeIndex, currentTimeMs]);

  // Helper to check if a token matches the selected token
  const isTokenSelected = (token: DisplayToken, lineIndex: number): boolean => {
    if (!selectedToken) return false;
    // Compare by charStart/charEnd and surface to handle re-renders
    return (
      selectedToken.charStart === token.charStart &&
      selectedToken.charEnd === token.charEnd &&
      selectedToken.surface === token.surface
    );
  };

  const renderLine = (index: number) => {
    const isActive = activeIndex === index;
    const line = tokenized.lines[index];
    const romaji = song.lyrics.romaji?.[index];
    const en = song.lyrics.en?.[index];

    if (!line) {
      return null;
    }

    // Build display tokens for this line
    const displayTokens = buildDisplayTokens(line.tokens);

    return (
      <div
        key={index}
        ref={isActive ? activeLineRef : null}
        className={`${styles.lyricsLine} ${isActive ? styles.active : ''}`}
      >
        <div className={styles.lyricsJa}>
          {displayTokens.length > 0 ? (
            displayTokens.map((token, tokenIndex) => {
              const isSelected = isTokenSelected(token, index);
              const isPunctuation = /[。、，！？・]/.test(token.surface);
              
              return (
                <span
                  key={tokenIndex}
                  className={`${styles.token} ${isSelected ? styles.selected : ''} ${
                    isPunctuation ? styles.punctuation : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTokenClick(index, tokenIndex, token);
                  }}
                  title={token.reading || token.surface}
                >
                  {token.surface}
                </span>
              );
            })
          ) : (
            <span className={styles.emptyLine}>{line.raw || '\u00A0'}</span>
          )}
        </div>
        {(mode === 'learning' || mode === 'study') && romaji && (
          <div className={styles.lyricsRomaji}>{romaji}</div>
        )}
        {mode === 'study' && en && <div className={styles.lyricsEn}>{en}</div>}
      </div>
    );
  };

  const containerClass = `${styles.tokenizedLyrics} ${className}`.trim();

  return (
    <div ref={containerRef} className={containerClass}>
      {tokenized.lines.map((_, index) => renderLine(index))}
    </div>
  );
}

