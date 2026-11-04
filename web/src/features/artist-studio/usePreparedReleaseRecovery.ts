import { useLayoutEffect, useRef, useState } from 'react';
import { matchesPreparedRelease, type PreparedRelease, type RecoveryContext } from './preparedReleaseRecovery';

/** Both opening an old feedback action and confirming a preview check the live
 * identity. The callback captured by a failed publication is never authoritative. */
export function usePreparedReleaseRecovery(context: RecoveryContext, restore: (release: PreparedRelease) => void, dismissFeedback: () => void) {
  const [candidate, setCandidate] = useState<PreparedRelease | null>(null);
  const current = useRef({ context, restore, dismissFeedback });
  useLayoutEffect(() => {
    current.current = { context, restore, dismissFeedback };
  });
  useLayoutEffect(() => {
    setCandidate(null);
  }, [context.owner, context.runtimeAddress, context.chainId, context.contentHash, context.connected]);
  function review(release: PreparedRelease) {
    if (!matchesPreparedRelease(release, current.current.context)) return;
    current.current.dismissFeedback();
    setCandidate(release);
  }
  function confirm() {
    if (!candidate || !matchesPreparedRelease(candidate, current.current.context)) return;
    current.current.restore(candidate);
    setCandidate(null);
  }
  return { review, confirm, cancel: () => setCandidate(null), candidate: candidate && matchesPreparedRelease(candidate, context) ? candidate : null };
}
