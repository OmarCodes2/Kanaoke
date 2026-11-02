import { useState, useEffect } from 'react';

const coverUrlCache = new Map<string, string>();
const pendingCoverUrls = new Map<string, Promise<string>>();

function getCoverUrl(coverPath: string): Promise<string> {
  const cachedUrl = coverUrlCache.get(coverPath);
  if (cachedUrl) return Promise.resolve(cachedUrl);

  const pendingUrl = pendingCoverUrls.get(coverPath);
  if (pendingUrl) return pendingUrl;

  const request = window.electronAPI.getCoverImageUrl(coverPath).then((url) => {
    coverUrlCache.set(coverPath, url);
    pendingCoverUrls.delete(coverPath);
    return url;
  }).catch((error) => {
    pendingCoverUrls.delete(coverPath);
    throw error;
  });

  pendingCoverUrls.set(coverPath, request);
  return request;
}

export function useCoverImage(coverPath: string | null | undefined): string | null {
  const [imageUrl, setImageUrl] = useState<string | null>(() =>
    coverPath ? coverUrlCache.get(coverPath) ?? null : null,
  );

  useEffect(() => {
    let cancelled = false;

    if (!coverPath) {
      setImageUrl(null);
      return;
    }

    const cachedUrl = coverUrlCache.get(coverPath);
    setImageUrl(cachedUrl ?? null);

    if (cachedUrl) return;

    getCoverUrl(coverPath)
      .then((url) => {
        if (!cancelled) setImageUrl(url);
      })
      .catch((error) => {
        console.error('Failed to load cover image:', error);
        if (!cancelled) setImageUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [coverPath]);

  return imageUrl;
}











