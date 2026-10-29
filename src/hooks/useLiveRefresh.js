import { useEffect, useRef } from 'react';

export default function useLiveRefresh(callback, intervalMs = 10000) {
  const latest = useRef(callback);
  useEffect(() => { latest.current = callback; }, [callback]);
  useEffect(() => {
    const refresh = () => {
      if (navigator.onLine && document.visibilityState !== 'hidden') latest.current(true);
    };
    const interval = setInterval(refresh, intervalMs);
    window.addEventListener('focus', refresh);
    window.addEventListener('byd-sync-complete', refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('byd-sync-complete', refresh);
    };
  }, [intervalMs]);
}
