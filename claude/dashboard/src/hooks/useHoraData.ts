import { useState, useEffect, useCallback, useRef } from "react";
import type { DashboardData } from "../types";

const POLL_INTERVAL = 10_000;

interface UseHoraDataReturn {
  data: DashboardData | null;
  error: string | null;
  isLive: boolean;
  lastUpdate: Date | null;
}

export function useHoraData(): UseHoraDataReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const hmrConnected = useRef(false);

  const applyData = useCallback((d: DashboardData) => {
    setData(d);
    setError(null);
    setLastUpdate(new Date());
  }, []);

  // Initial fetch
  useEffect(() => {
    fetch("/api/hora-data")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DashboardData>;
      })
      .then(applyData)
      .catch((e: Error) => setError(e.message));
  }, [applyData]);

  // HMR listener
  useEffect(() => {
    if (import.meta.hot) {
      import.meta.hot.on("hora:update", (payload: DashboardData) => {
        hmrConnected.current = true;
        setIsLive(true);
        applyData(payload);
      });
    }
  }, [applyData]);

  // Fallback polling when HMR not available
  useEffect(() => {
    // Give HMR 3 seconds to connect before falling back to polling
    const checkTimer = setTimeout(() => {
      if (hmrConnected.current) return;

      const interval = setInterval(() => {
        if (hmrConnected.current) {
          clearInterval(interval);
          return;
        }
        fetch("/api/hora-data")
          .then((r) => r.json() as Promise<DashboardData>)
          .then(applyData)
          .catch(() => {
            // silent failure on poll
          });
      }, POLL_INTERVAL);

      return () => clearInterval(interval);
    }, 3000);

    return () => clearTimeout(checkTimer);
  }, [applyData]);

  return { data, error, isLive, lastUpdate };
}
