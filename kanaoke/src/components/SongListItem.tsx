import type { SongSummary } from '../types';
import { useCoverImage } from '../hooks/useCoverImage';
import styles from './SongListItem.module.css';

interface SongListItemProps {
  song: SongSummary;
  isSelected: boolean;
  onClick: () => void;
  coverPath?: string | null;
}

export default function SongListItem({
  song,
  isSelected,
  onClick,
  coverPath,
}: SongListItemProps) {
  const coverUrl = useCoverImage(coverPath);
  const getStatusInfo = (status: SongSummary['status']) => {
    switch (status) {
      case 'synced':
        return { label: 'Synced', color: '#66ff88' };
      case 'needs-sync':
        return { label: 'Needs sync', color: '#ffaa66' };
      case 'missing-lyrics':
        return { label: 'Missing lyrics', color: '#ff6666' };
      case 'invalid':
        return { label: 'Invalid', color: '#ff6666' };
    }
  };

  const getInitials = (title: string) => {
    return title
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDuration = (sec?: number) => {
    if (!sec) return '--:--';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      className={`${styles.songCard} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      <div className={styles.thumbnail}>
        {coverUrl ? (
          <>
            <img
              src={coverUrl}
              alt={song.title}
              className={styles.coverImage}
              onError={(e) => {
                console.error('Failed to load thumbnail image:', e);
                e.currentTarget.style.display = 'none';
                const placeholder = e.currentTarget.parentElement?.querySelector(`.${styles.placeholderGradient}`) as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
            <div className={styles.coverFade} />
          </>
        ) : null}
        <div className={styles.placeholderGradient}>
          {getInitials(song.title)}
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.titleWrapper}>
          <div className={styles.title}>{song.title}</div>
        </div>
        <div className={styles.artist}>{song.artist}</div>
        <div className={styles.meta}>
          <span className={styles.duration}>{formatDuration(song.durationSec)}</span>
          <span className={styles.statusIndicator} style={{ '--status-color': getStatusInfo(song.status).color } as React.CSSProperties}>
            <span className={styles.statusDot} />
            <span className={styles.statusLabel}>{getStatusInfo(song.status).label}</span>
          </span>
        </div>
      </div>
    </div>
  );
}


