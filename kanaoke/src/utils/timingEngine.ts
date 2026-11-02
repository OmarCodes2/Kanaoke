import type { TimingData } from '../types';

export function getActiveLineIndex(
  playbackMs: number,
  timing: TimingData,
): number | null {
  const adjustedMs = playbackMs - timing.offsetMs;
  
  if (adjustedMs < 0 || timing.lines.length === 0) {
    return null;
  }
  
  // Find the last line that has started
  for (let i = timing.lines.length - 1; i >= 0; i--) {
    if (adjustedMs >= timing.lines[i].startMs) {
      return i;
    }
  }
  
  return null;
}

export function getNextLineStartMs(
  currentIndex: number,
  timing: TimingData,
): number | null {
  if (currentIndex < 0 || currentIndex >= timing.lines.length - 1) {
    return null;
  }
  
  return timing.lines[currentIndex + 1].startMs + timing.offsetMs;
}

export function getCurrentLineStartMs(
  index: number,
  timing: TimingData,
): number | null {
  if (index < 0 || index >= timing.lines.length) {
    return null;
  }
  
  return timing.lines[index].startMs + timing.offsetMs;
}











