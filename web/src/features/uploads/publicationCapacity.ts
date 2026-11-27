import type { TransactionFeedback } from '../../shared/types';

type BulletinAccount = { account: string; genesis: string };
type PublicationCapacity =
  | (BulletinAccount & { kind: 'bulletin-authorization'; minimumExpiryBlock: number })
  | (BulletinAccount & { kind: 'bulletin-quota'; transactions: number; storageBytes: string; renewalBytes: string; retainedOnly?: true })
  | { kind: 'release-slots' | 'upload-window' };

export class PublicationCapacityError extends Error {
  constructor(readonly capacity: PublicationCapacity) {
    super(
      'account' in capacity
        ? 'Bulletin storage needs a refill'
        : capacity.kind === 'release-slots'
          ? 'New release slots are full'
          : 'The upload limit has been reached'
    );
    this.name = 'PublicationCapacityError';
  }
}

function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function byteCount(value: unknown): value is string {
  return typeof value === 'string' && /^(0|[1-9][0-9]{0,38})$/.test(value);
}

export function parsePublicationCapacity(value: unknown): PublicationCapacityError | null {
  if (!value || typeof value !== 'object') return null;
  const { kind, account, genesis, minimumExpiryBlock, transactions, storageBytes, renewalBytes, retainedOnly } = value as Record<string, unknown>;
  if (kind === 'release-slots') return new PublicationCapacityError({ kind });
  if (typeof account !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{46,50}$/.test(account)) return null;
  if (typeof genesis !== 'string' || !/^0x[0-9a-f]{64}$/.test(genesis)) return null;
  if (kind === 'bulletin-authorization' && nonnegativeInteger(minimumExpiryBlock))
    return new PublicationCapacityError({ kind, account, genesis, minimumExpiryBlock });
  if (
    kind === 'bulletin-quota' &&
    nonnegativeInteger(transactions) &&
    byteCount(storageBytes) &&
    byteCount(renewalBytes) &&
    (transactions > 0 || storageBytes !== '0' || renewalBytes !== '0')
  )
    return new PublicationCapacityError({ kind, account, genesis, transactions, storageBytes, renewalBytes, ...(retainedOnly === true && { retainedOnly }) });
  return null;
}

const AUTHORIZATION_GUIDE = 'https://docs.polkadot.com/reference/apps/infrastructure/bulletin-chain/authorization/';

export function publicationCapacityFeedback(
  error: PublicationCapacityError,
  release: { runtimeAddress: string | null; contentHash: string }
): Pick<TransactionFeedback, 'title' | 'message' | 'facts' | 'technicalFacts'> {
  const { capacity } = error;
  if (!('account' in capacity)) {
    if (capacity.kind === 'upload-window')
      return {
        title: error.message,
        message: 'The temporary upload limit will reset. Keep this draft open and try again later, or contact Dotify support if it persists.'
      };
    return {
      title: error.message,
      message: 'Ask the Dotify operator to open a release slot for your artist space, then retry with this draft.',
      technicalFacts: [
        { label: 'Artist space', value: release.runtimeAddress ?? 'Unavailable', code: true },
        { label: 'Audio fingerprint', value: release.contentHash, code: true }
      ],
      facts: [
        {
          label: 'Release slot request',
          value: 'Artist space and audio fingerprint',
          copyLabel: 'Copy release slot request',
          copyValue: [
            'Dotify release slot request',
            `Artist space: ${release.runtimeAddress ?? 'Unavailable'}`,
            `Audio fingerprint: ${release.contentHash}`
          ].join('\n')
        }
      ]
    };
  }

  const amounts =
    capacity.kind === 'bulletin-authorization'
      ? [{ label: 'Authorization expiry', value: `Block ${capacity.minimumExpiryBlock.toLocaleString()} or later`, exact: String(capacity.minimumExpiryBlock) }]
      : [
          { label: 'Extra transactions', value: capacity.transactions.toLocaleString(), exact: String(capacity.transactions) },
          { label: 'Extra storage bytes', value: BigInt(capacity.storageBytes).toLocaleString(), exact: capacity.storageBytes },
          { label: 'Extra renewal bytes', value: BigInt(capacity.renewalBytes).toLocaleString(), exact: capacity.renewalBytes }
        ].filter(fact => fact.exact !== '0');
  const request = [
    'Dotify Bulletin publishing account refill',
    `Network genesis: ${capacity.genesis}`,
    `Public account: ${capacity.account}`,
    ...amounts.map(({ label, exact }) => `${label}: ${exact}`)
  ].join('\n');
  return {
    title: error.message,
    message:
      capacity.kind === 'bulletin-authorization'
        ? 'The publishing account needs a valid Bulletin storage authorization. Share the refill details with the account operator, then retry.'
        : capacity.retainedOnly
          ? 'These amounts restore the storage reserved for earlier releases. Share the details with the publishing account operator, then check what your release needs.'
          : 'Share these minimum amounts with the publishing account operator to refill Bulletin storage. You can retry with the same draft after the refill.',
    technicalFacts: [{ label: 'Bulletin network genesis', value: capacity.genesis, code: true }],
    facts: [
      ...amounts.map(({ label, value }) => ({ label, value })),
      { label: 'Refill details', value: capacity.account, code: true, copyLabel: 'Copy Bulletin refill request', copyValue: request },
      { label: 'Bulletin storage', value: 'How to request authorization', href: AUTHORIZATION_GUIDE }
    ]
  };
}
