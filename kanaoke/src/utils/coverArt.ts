/**
 * Gets the cover image path (returns the path, not a URL)
 * The actual URL will be loaded via IPC using getCoverImageUrl
 */
export function getCoverArtPath(songPath: string, coverPath?: string): string | null {
  // If coverPath is provided (from SongSummary), use it directly
  if (coverPath) {
    return coverPath;
  }
  
  // Fallback: try common cover file names
  const extensions = ['.png', '.jpg', '.jpeg'];
  
  for (const ext of extensions) {
    // Use path separator based on the songPath format
    const pathSeparator = songPath.includes('\\') ? '\\' : '/';
    const fallbackCoverPath = `${songPath}${pathSeparator}cover${ext}`;
    // Note: We can't check if file exists here (renderer process)
    // Return the first potential path and let the caller handle it
    return fallbackCoverPath;
  }
  
  return null;
}

/**
 * Gets initials from a title for placeholder
 */
export function getInitials(title: string): string {
  return title
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


