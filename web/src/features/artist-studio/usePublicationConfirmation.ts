import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
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

// Reconciliation is read-only. The approved write is never called by a timer
// or the recovery CTA; a hash collision in another artist runtime cannot pass.
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
  setFeedback: (feedback: TransactionFeedback | null) => void;
  setStatus: (status: string) => void;
  activeFeedback?: TransactionFeedback | null;
  onPublished?: (account: `0x${string}`) => void;
}) {
  const [pending, setPending] = useState<PendingPublication | null>(null);
  const latest = useRef({ refresh, setFeedback, setStatus, activeFeedback, onPublished });
  useLayoutEffect(() => {
    latest.current = { refresh, setFeedback, setStatus, activeFeedback, onPublished };
  });
  const generation = useRef(0);
  const completedOperation = useRef<string | null>(null);
  const complete = useCallback((item: PendingPublication) => {
    // Catalog updates and the fresh read can observe the same release together.
    // Deliver completion once so a later observation cannot reopen the list.
    if (completedOperation.current === item.feedback.operationId) return;
    completedOperation.current = item.feedback.operationId ?? null;
    setPending(null);
    latest.current.setStatus('Release published');
    if (latest.current.activeFeedback && latest.current.activeFeedback.operationId !== item.feedback.operationId) return;
    latest.current.setFeedback({
      ...item.feedback,
      tone: 'success',
      title: 'Release published',
      message: 'Your release is now visible in Dotify.',
      recoveryAction: undefined,
      steps: buildReleasePublicationRoadmap('complete', item.feedback.txHash)
    });
    latest.current.onPublished?.(item.account);
  }, []);
  // The approved runtime/hash belongs to the operation, not the current
  // wallet. Public, read-only reconciliation survives account changes; keep
  // publication blocked until this operation completes or is checked again.
  useEffect(() => {
    if (pending && publicationIsVisible(tracks, pending)) complete(pending);
  }, [tracks, pending, complete]);
  useEffect(() => {
    if (!pending) return;
    const current = ++generation.current;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        const refreshed = await latest.current.refresh(pending!.hash, { fresh: true });
        if (generation.current !== current) return;
        if (publicationIsVisible(refreshed, pending!)) {
          complete(pending!);
          return;
        }
      } catch {
        /* A temporary read failure does not revoke the approved write. */
      }
      if (generation.current !== current) return;
      if (++attempts < 12) timer = setTimeout(check, 5000);
      else {
        latest.current.setStatus('Published on the network; catalog update delayed');
        if (latest.current.activeFeedback && latest.current.activeFeedback.operationId !== pending!.feedback.operationId) return;
        latest.current.setFeedback({
          ...pending!.feedback,
          tone: 'error',
          title: 'Catalog update delayed',
          message: 'Your approval is confirmed. Check visibility again without publishing or paying again.',
          recoveryAction: {
            label: 'Check visibility',
            run: () => {
              setPending(value => (value ? { ...value } : value));
            }
          }
        });
      }
    }
    void check();
    return () => {
      generation.current += 1;
      clearTimeout(timer);
    };
  }, [pending, complete]);
  return {
    pending: Boolean(pending),
    confirm: (item: PendingPublication) => {
      item = { ...item, feedback: { ...item.feedback, operationId: `publication:${item.runtime}:${item.hash}` } };
      completedOperation.current = null;
      setPending(item);
      setStatus('Making your release visible');
      setFeedback({
        ...item.feedback,
        tone: 'pending',
        title: 'Making your release visible',
        message: 'Your approval is confirmed. Dotify is refreshing the catalog; no further approval is needed.'
      });
    }
  };
}
