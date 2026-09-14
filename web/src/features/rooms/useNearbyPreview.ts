import { useCallback, useEffect, useRef, useState } from 'react';
import { useSessionContext } from '../../app/providers';
import { roomExperienceFlags } from './roomExperienceFlags';

export type NearbyArea = { id: string; label: string };
export type NearbyResult = { discoveryId: string; roomId: string; title: string; artist: string; listenerCountBucket: string; expiresAt: number };
export type NearbyReply = { ok: boolean; message?: string; areas?: NearbyArea[]; expiresAt?: number; results?: NearbyResult[] };

// No automatic location, lookup, persistence, or retry. All area disclosure
// follows a visible form submission, and unmount invalidates late replies.
export function useNearbyPreview() {
  const { socketRef, socketStatus } = useSessionContext();
  const [areas, setAreas] = useState<NearbyArea[]>([]);
  const [error, setError] = useState('');
  const generationRef = useRef(0);
  useEffect(
    () => () => {
      generationRef.current += 1;
    },
    []
  );
  const request = useCallback(
    (event: string, payload?: unknown): Promise<NearbyReply> => {
      const socket = socketRef.current;
      if (!roomExperienceFlags.nearby || !socket?.connected) return Promise.resolve({ ok: false, message: 'Reconnect to use this preview.' });
      const current = generationRef.current;
      return new Promise(resolve => {
        const reply = (failure: Error | null, result?: NearbyReply) => {
          if (current !== generationRef.current) return resolve({ ok: false });
          resolve(failure || !result ? { ok: false, message: 'The room service did not confirm. Try again when connected.' } : result);
        };
        if (payload === undefined) socket.timeout(5000).volatile.emit(event, reply);
        else socket.timeout(5000).volatile.emit(event, payload, reply);
      });
    },
    [socketRef]
  );
  async function loadAreas() {
    const result = await request('nearby:areas');
    if (result.ok && result.areas) {
      setAreas(result.areas);
      setError('');
    } else setError(result.message || 'Nearby preview is unavailable on this room service. Room links and codes still work.');
  }
  return { socketRef, connected: socketStatus === 'online', areas, error, setError, request, loadAreas, generationRef };
}
