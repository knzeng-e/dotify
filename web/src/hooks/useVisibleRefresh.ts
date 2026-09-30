import { useEffect, useLayoutEffect, useRef } from 'react';

export type RefreshGate = { current: Promise<void> | null };

export async function runSerializedRefresh(gate: RefreshGate, refresh: () => Promise<void>, rerunAfterActive = false): Promise<void> {
  const active = gate.current;
  if (active) {
    await active;
    if (rerunAfterActive) await runSerializedRefresh(gate, refresh, true);
    return;
  }

  const pending = Promise.resolve().then(refresh);
  gate.current = pending;
  try {
    await pending;
  } finally {
    if (gate.current === pending) gate.current = null;
  }
}

export function useVisibleRefresh(refresh: () => Promise<void>, scope: string | null, intervalMs = 15_000) {
  const refreshRef = useRef(refresh);
  useLayoutEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  useEffect(() => {
    if (!scope) return;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function run() {
      clearTimeout(timer);
      if (stopped || running || document.visibilityState === 'hidden') return;
      running = true;
      try {
        await refreshRef.current();
      } finally {
        running = false;
        if (!stopped)
          timer = setTimeout(() => {
            void run();
          }, intervalMs);
      }
    }
    const resume = () => {
      void run();
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    void run();
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [scope, intervalMs]);
}
