import { useEffect, useState } from 'react';
import type { DisplayToken } from '../types';
import type { DictionaryLookupResult } from '../types';
import { useDictionaryStatus } from './useDictionaryStatus';

export function useDictionaryLookup(token: DisplayToken | null) {
  const status = useDictionaryStatus();
  const [results, setResults] = useState<DictionaryLookupResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setResults([]);
      setLoading(false);
      return;
    }

    if (status.status !== 'ready') {
      setResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    window.electronAPI
      .lookupDictionary({
        base: token.base,
        surface: token.surface,
        reading: token.reading,
      })
      .then((nextResults) => {
        if (!cancelled) {
          setResults(nextResults);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, status.status]);

  return { status, results, loading };
}
