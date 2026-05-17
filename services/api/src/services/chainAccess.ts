export type TrackAccessRequest = {
  contentHash: string;
  listenerAddress: string;
  chainId: number;
};

export type TrackAccessResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export async function checkTrackAccess(_request: TrackAccessRequest): Promise<TrackAccessResult> {
  return {
    allowed: false,
    reason: 'On-chain access checks are not implemented in this skeleton',
  };
}
