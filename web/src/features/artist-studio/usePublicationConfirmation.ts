import { useCallback, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { CatalogTrack, TransactionFeedback } from '../../shared/types';
import { runtimeAddressFromTrackId } from '../catalog/trackModel';
import { buildReleasePublicationRoadmap } from './releaseForm';

type PendingPublication = { runtime: `0x${string}`; hash: `0x${string}`; account: `0x${string}`; feedback: TransactionFeedback };
export const publicationIsVisible = (tracks: CatalogTrack[], pending: Pick<PendingPublication, 'runtime' | 'hash'>) =>
  tracks.some(
    track =>
      track.active !== false &&
      track.hash.toLowerCase() === pending.hash.toLowerCase() &&
      runtimeAddressFromTrackId(track)?.toLowerCase() === pending.runtime.toLowerCase()
  );

export function catalogVisibilityFeedback(base: TransactionFeedback, delayed: boolean, checking: boolean, check: () => void): TransactionFeedback {
  return {
    ...base,
    tone: 'pending',
    publicationVisibility: delayed ? 'delayed' : 'checking',
    title: 'Release approved',
    message: delayed
      ? 'Your release is registered. It is taking longer to appear in the catalog.'
      : 'Your release is registered. Dotify is checking its visibility in the catalog.',
    recoveryAction: { label: 'Check visibility', run: check, disabled: checking },
    steps: buildReleasePublicationRoadmap('catalog', base.txHash)
  };
}

// Timers and recovery only read the catalog. Registry approval is never repeated.
export function usePublicationConfirmation({
  tracks,
  refresh,
  setFeedback,
  setStatus,
  activeFeedback,
  onPublished
}: {
  tracks: CatalogTrack[];
  refresh: (hash?: `0x${string}`, options?: { fresh?: boolean }) => Promise<CatalogTrack[]>;
  setFeedback: Dispatch<SetStateAction<TransactionFeedback | null>>;
  setStatus: (status: string) => void;
  activeFeedback?: TransactionFeedback | null;
  onPublished?: (account: `0x${string}`) => void;
}) {
  const [pending, setPending] = useState<PendingPublication | null>(null);
  const [checking, setChecking] = useState(false);
  const latest = useRef({ refresh, setFeedback, setStatus, activeFeedback, onPublished });
  useLayoutEffect(() => {
    latest.current = { refresh, setFeedback, setStatus, activeFeedback, onPublished };
  });
  const generation = useRef(0);
  const activeRead = useRef<object | null>(null);
  const delayedOperation = useRef<string | null>(null);
  const completedOperation = useRef<string | null>(null);
  const checkVisibility = useCallback(() => {
    if (activeRead.current) return;
    setPending(value => (value ? { ...value } : value));
  }, []);
  const showVisibility = useCallback(
    (item: PendingPublication, delayed: boolean, reading: boolean) => {
      latest.current.setFeedback(previous =>
        previous && previous.operationId !== item.feedback.operationId ? previous : catalogVisibilityFeedback(item.feedback, delayed, reading, checkVisibility)
      );
    },
    [checkVisibility]
  );
  const complete = useCallback((item: PendingPublication) => {
    if (completedOperation.current === item.feedback.operationId) return;
    completedOperation.current = item.feedback.operationId ?? null;
    generation.current += 1;
    activeRead.current = null;
    setChecking(false);
    setPending(null);
    latest.current.setStatus('Release published');
    if (latest.current.activeFeedback && latest.current.activeFeedback.operationId !== item.feedback.operationId) return;
    latest.current.setFeedback(previous =>
      previous && previous.operationId !== item.feedback.operationId
        ? previous
        : {
            ...item.feedback,
            tone: 'success',
            title: 'Release published',
            message: 'Your release is now visible in Dotify.',
            publicationVisibility: undefined,
            recoveryAction: undefined,
            steps: buildReleasePublicationRoadmap('complete', item.feedback.txHash)
          }
    );
    latest.current.onPublished?.(item.account);
  }, []);
  // Music and the artist editor share these tracks. A later catalogue refresh
  // completes the operation even after the bounded background checks have ended.
  useEffect(() => {
    if (pending && publicationIsVisible(tracks, pending)) complete(pending);
  }, [tracks, pending, complete]);
  useEffect(() => {
    if (!pending || completedOperation.current === pending.feedback.operationId) return;
    const current = ++generation.current;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      const token = {};
      activeRead.current = token;
      setChecking(true);
      showVisibility(pending!, delayedOperation.current === pending!.feedback.operationId, true);
      try {
        const refreshed = await latest.current.refresh(pending!.hash, { fresh: true });
        if (generation.current !== current) return;
        if (publicationIsVisible(refreshed, pending!)) {
          complete(pending!);
          return;
        }
      } catch {
        // A failed read cannot revoke a confirmed registry approval.
      } finally {
        if (generation.current === current && activeRead.current === token) {
          activeRead.current = null;
          setChecking(false);
        }
      }
      if (generation.current !== current) return;
      attempts += 1;
      const delayed = attempts >= 12 || delayedOperation.current === pending!.feedback.operationId;
      if (delayed) delayedOperation.current = pending!.feedback.operationId ?? null;
      latest.current.setStatus(delayed ? 'Release approved; still updating the catalog' : 'Release approved; updating the catalog');
      showVisibility(pending!, delayed, false);
      // Keep checking more slowly after the first minute, with a finite request
      // budget. The observer and explicit read-only action remain available.
      if (attempts < 28) timer = setTimeout(check, delayed ? 30_000 : 5000);
    }
    void check();
    return () => {
      generation.current += 1;
      activeRead.current = null;
      clearTimeout(timer);
    };
  }, [pending, complete, showVisibility]);
  return {
    pending: Boolean(pending),
    checking,
    checkVisibility,
    confirm: (item: PendingPublication) => {
      item = {
        ...item,
        feedback: { ...item.feedback, operationKind: 'publication', operationId: item.feedback.operationId ?? `publication:${item.runtime}:${item.hash}` }
      };
      completedOperation.current = null;
      delayedOperation.current = null;
      setPending(item);
      setStatus('Release approved; updating the catalog');
      showVisibility(item, false, true);
    }
  };
}
