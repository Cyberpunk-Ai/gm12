import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics-tracker';

export function AnalyticsTracker() {
  const location = useLocation();
  const enterRef = useRef<number>(Date.now());
  const lastPathRef = useRef<string>('');

  useEffect(() => {
    if (lastPathRef.current === location.pathname) return;
    const duration = Date.now() - enterRef.current;
    // record the previous pageview's duration inside the new event's metadata
    trackEvent({
      path: location.pathname,
      metadata: { previous_path: lastPathRef.current || null, previous_duration_ms: lastPathRef.current ? duration : null },
    });
    lastPathRef.current = location.pathname;
    enterRef.current = Date.now();
  }, [location.pathname]);

  return null;
}
