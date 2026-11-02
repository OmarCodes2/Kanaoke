import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './FloatingKButton.module.css';

interface FloatingKButtonProps {
  isAudioPlaying?: boolean;
  audioEnergy?: number; // 0-1, for future audio analysis
}

export default function FloatingKButton({ 
  isAudioPlaying = false,
  audioEnergy = 0 
}: FloatingKButtonProps) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleImportSongs = () => {
    setIsExpanded(false);
    navigate('/import?tab=import');
  };

  const handleAddMap = () => {
    setIsExpanded(false);
    navigate('/import?tab=create');
  };

  return (
    <div ref={containerRef} className={styles.container}>
      {/* Pop-out action buttons */}
      <div className={`${styles.actionsContainer} ${isExpanded ? styles.expanded : ''}`}>
        <button
          className={`${styles.actionButton} ${styles.actionImport}`}
          onClick={handleImportSongs}
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
          className={`${styles.actionButton} ${styles.actionAddMap}`}
          onClick={handleAddMap}
          aria-label="Add map"
          title="Add map"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* Main K button */}
      <button
        ref={buttonRef}
        className={`${styles.kButton} ${isAudioPlaying ? styles.playing : ''}`}
        onClick={handleToggle}
        aria-label="Menu"
      >
        <span className={styles.kLetter}>K</span>
      </button>
    </div>
  );
}

