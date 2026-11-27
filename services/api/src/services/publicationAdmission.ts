/** A configured storage allowance does not admit every future artist release. */
export class PublicationAdmissionError extends Error {
  readonly code = 'STREAMING_PUBLICATION_NOT_ADMITTED';
  constructor() {
    super('New release publishing is not enabled for this audio yet. Your draft is safe. Please contact the Dotify operator before trying again.');
    this.name = 'PublicationAdmissionError';
  }
}

type BulletinRefill = {
  account: string;
  genesis: string;
};

export type PublicationCapacity =
  | (BulletinRefill & { kind: 'bulletin-authorization'; minimumExpiryBlock: number })
  | (BulletinRefill & { kind: 'bulletin-quota'; transactions: number; storageBytes: string; renewalBytes: string; retainedOnly?: true })
  | { kind: 'release-slots' };

export class PublicationCapacityError extends Error {
  readonly code = 'STREAMING_PUBLICATION_CAPACITY';

  constructor(readonly capacity: PublicationCapacity) {
    super(
      capacity.kind === 'release-slots'
        ? 'Dotify has no new release slots available. Ask the Dotify operator to make room for your release.'
        : capacity.kind === 'bulletin-authorization'
          ? 'Bulletin authorization is unavailable or expiring. Renew the publishing account authorization to continue.'
          : 'Insufficient Bulletin quota including renewal reserve. Refill the publishing account to continue.'
    );
    this.name = 'PublicationCapacityError';
  }
}

export function requireBulletinAuthorization(identity: BulletinRefill, expiresAt: number, minimumExpiryBlock: number) {
  if (expiresAt < minimumExpiryBlock)
    throw new PublicationCapacityError({ kind: 'bulletin-authorization', account: identity.account, genesis: identity.genesis, minimumExpiryBlock });
}

export function requireBulletinQuota(
  identity: BulletinRefill,
  transactions: number,
  storageBytes: bigint,
  renewalBytes: bigint,
  options?: { retainedOnly: true }
) {
  if (transactions > 0 || storageBytes > 0n || renewalBytes > 0n)
    throw new PublicationCapacityError({
      kind: 'bulletin-quota',
      account: identity.account,
      genesis: identity.genesis,
      transactions: Math.max(0, transactions),
      storageBytes: (storageBytes > 0n ? storageBytes : 0n).toString(),
      renewalBytes: (renewalBytes > 0n ? renewalBytes : 0n).toString(),
      ...options
    });
}
