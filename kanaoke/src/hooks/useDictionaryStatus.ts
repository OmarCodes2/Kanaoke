import { useEffect, useState } from 'react';
import type { DictionaryStatus } from '../types';

export function useDictionaryStatus() {
  const [status, setStatus] = useState<DictionaryStatus>({ status: 'not-configured' });

  useEffect(() => {
    window.electronAPI.getDictionaryStatus().then(setStatus);
    return window.electronAPI.onDictionaryStatusChanged(setStatus);
  }, []);

  return status;
}
