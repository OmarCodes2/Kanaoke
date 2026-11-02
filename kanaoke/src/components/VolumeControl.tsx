import { useEffect, useRef } from 'react';
import styles from './VolumeControl.module.css';

interface VolumeControlProps {
  volume: number;
  onChange: (volume: number) => void;
  className?: string;
}

export default function VolumeControl({ volume, onChange, className = '' }: VolumeControlProps) {
  const percent = Math.round(volume * 100);
  const controlRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const control = controlRef.current;
    if (!control) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY === 0) return;
      event.preventDefault();
      event.stopPropagation();
      onChange(volume + (event.deltaY < 0 ? 0.05 : -0.05));
    };

    control.addEventListener('wheel', handleWheel, { passive: false });
    return () => control.removeEventListener('wheel', handleWheel);
  }, [onChange, volume]);

  return (
    <div
      ref={controlRef}
      className={`${styles.control} ${className}`}
      title="Drag or use the mouse wheel here to adjust volume"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
        {volume > 0 && <path d="M15 9.5a4 4 0 0 1 0 5" />}
        {volume > 0.55 && <path d="M17.5 7a7 7 0 0 1 0 10" />}
      </svg>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Volume"
        aria-valuetext={`${percent}%`}
      />
      <output aria-live="polite">{percent}%</output>
    </div>
  );
}
