import { z } from 'zod';

export const metaSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  artist: z.string().min(1),
  source: z.string().optional(),
  durationSec: z.number().positive().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const timingLineSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().nonnegative(),
});

export const timingSchema = z.object({
  version: z.number().int().positive(),
  offsetMs: z.number(),
  lines: z.array(timingLineSchema),
});

export function validateTimingMonotonic(timing: { lines: { startMs: number }[] }): boolean {
  // Only check stamped lines (startMs > 0) for monotonic validation
  // Unstamped lines (startMs === 0) are allowed and should be ignored
  const stampedLines = timing.lines.filter(line => line.startMs > 0);
  
  for (let i = 1; i < stampedLines.length; i++) {
    if (stampedLines[i].startMs <= stampedLines[i - 1].startMs) {
      return false;
    }
  }
  return true;
}

export function validateLyricLineCounts(
  ja: string[],
  romaji?: string[],
  en?: string[],
): { valid: boolean; error?: string } {
  const jaCount = ja.length;
  
  if (romaji && romaji.length !== jaCount) {
    return {
      valid: false,
      error: `Japanese has ${jaCount} lines but Romaji has ${romaji.length} lines`,
    };
  }
  
  if (en && en.length !== jaCount) {
    return {
      valid: false,
      error: `Japanese has ${jaCount} lines but English has ${en.length} lines`,
    };
  }
  
  return { valid: true };
}

export function validateTimingLineCount(
  timing: { lines: { index: number }[] },
  lyricLineCount: number,
): { valid: boolean; error?: string } {
  if (timing.lines.length !== lyricLineCount) {
    return {
      valid: false,
      error: `Timing has ${timing.lines.length} lines but lyrics have ${lyricLineCount} lines`,
    };
  }
  
  // Check indices
  for (let i = 0; i < timing.lines.length; i++) {
    if (timing.lines[i].index !== i) {
      return {
        valid: false,
        error: `Timing line index mismatch: expected ${i}, got ${timing.lines[i].index}`,
      };
    }
  }
  
  return { valid: true };
}

