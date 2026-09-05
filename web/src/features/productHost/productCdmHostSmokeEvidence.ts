export const PRODUCT_CDM_PAYMENT_SMOKE_EVENT = 'dotify:product-cdm-payment-smoke';
export const PRODUCT_HOST_KEY_SMOKE_EVENT = 'dotify:product-host-key-smoke';
export const PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT = 'dotify:product-cdm-host-smoke-evidence';
export const PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY = 'dotify:product-cdm-host-smoke-evidence:v1';

const PRODUCT_SR25519_SIGNATURE_SCHEME = 'product-sr25519-v1';
const MAX_STORED_EVENTS = 40;

export type ProductCdmHostSmokeTone = 'ok' | 'warning' | 'error' | 'unknown';
export type ProductHostKeySmokePhase =
  | 'session-created'
  | 'session-unavailable'
  | 'session-rejected'
  | 'session-error'
  | 'key-allowed'
  | 'key-denied'
  | 'key-error';

export type ProductCdmPaymentSmokeMetric = {
  txHash: `0x${string}`;
  runtimeAddress: `0x${string}`;
  contentHash: `0x${string}`;
  listenerAddress: `0x${string}`;
  amountPlanck: string;
  hasPaid: boolean | null;
  canAccess: boolean | null;
  attempts: number;
  ok: boolean;
  error: string | null;
  timestamp: number;
};

export type ProductHostKeySmokeMetric = {
  phase: ProductHostKeySmokePhase;
  path: 'session' | 'per-request';
  signatureScheme: typeof PRODUCT_SR25519_SIGNATURE_SCHEME;
  address: `0x${string}`;
  productPublicKey: `0x${string}`;
  chainId: number;
  purpose?: 'individual' | 'room_host';
  contentHash?: `0x${string}`;
  access?: 'allowed' | 'denied';
  playbackMode?: 'full';
  runtime?: `0x${string}`;
  status?: number;
  code?: string;
  error?: string | null;
  timestamp: number;
};

export type ProductCdmHostOperatorObservation = {
  kind: 'operator-observation';
  observation: 'host-approval-explicit';
  ok: boolean;
  timestamp: number;
};

export type ProductCdmHostSmokeEvent =
  | ({ kind: 'payment' } & ProductCdmPaymentSmokeMetric)
  | ({ kind: 'key' } & ProductHostKeySmokeMetric)
  | ProductCdmHostOperatorObservation;

export type ProductCdmHostSmokeContext = {
  productId: string;
  productHostMode: string;
  productHostStatus: string;
  runtimeAdapterKind: string;
  walletMethod: string | null;
  listenerAddress: string | null;
  substrateAddress: string | null;
  productPublicKey: string | null;
  expectedChainId: number | null;
  apiConfigured: boolean;
};

export type ProductCdmHostSmokeCheck = {
  id: string;
  label: string;
  tone: ProductCdmHostSmokeTone;
  detail: string;
};

export type ProductCdmHostSmokeEvidence = {
  schemaVersion: 1;
  capturedAt: string;
  summary: { tone: ProductCdmHostSmokeTone; label: string; problemCount: number };
  context: ProductCdmHostSmokeContext;
  checks: ProductCdmHostSmokeCheck[];
  events: ProductCdmHostSmokeEvent[];
  limitations: string[];
};

type SmokeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getSmokeStorage(storage?: SmokeStorage | null): SmokeStorage | null {
  if (storage !== undefined) return storage;
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isHexString(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value);
}

function text(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== 'string') return undefined;
  const redacted = value
    .replace(/0x[0-9a-fA-F]{64,}/g, '<redacted-hex>')
    .replace(/[A-Za-z0-9_-]{48,}/g, '<redacted-token>')
    .trim();
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength - 1)}...` : redacted;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalPurpose(value: unknown): ProductHostKeySmokeMetric['purpose'] | undefined {
  return value === 'individual' || value === 'room_host' ? value : undefined;
}

function optionalAccess(value: unknown): ProductHostKeySmokeMetric['access'] | undefined {
  return value === 'allowed' || value === 'denied' ? value : undefined;
}

function optionalPlaybackMode(value: unknown): ProductHostKeySmokeMetric['playbackMode'] | undefined {
  return value === 'full' ? value : undefined;
}

function optionalPath(value: unknown): ProductHostKeySmokeMetric['path'] | null {
  return value === 'session' || value === 'per-request' ? value : null;
}

function optionalKeyPhase(value: unknown): ProductHostKeySmokePhase | null {
  if (
    value === 'session-created' ||
    value === 'session-unavailable' ||
    value === 'session-rejected' ||
    value === 'session-error' ||
    value === 'key-allowed' ||
    value === 'key-denied' ||
    value === 'key-error'
  ) {
    return value;
  }
  return null;
}

function amountPlanckText(value: unknown): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.trunc(value)).toString();
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return '0';
}

export function normalizeProductCdmPaymentSmokeDetail(detail: unknown): ProductCdmPaymentSmokeMetric | null {
  if (!isRecord(detail)) return null;
  if (!isHexString(detail.txHash) || !isHexString(detail.runtimeAddress) || !isHexString(detail.contentHash) || !isHexString(detail.listenerAddress)) {
    return null;
  }
  if (typeof detail.ok !== 'boolean') return null;

  return {
    txHash: detail.txHash,
    runtimeAddress: detail.runtimeAddress,
    contentHash: detail.contentHash,
    listenerAddress: detail.listenerAddress,
    amountPlanck: amountPlanckText(detail.amountPlanck),
    hasPaid: nullableBoolean(detail.hasPaid),
    canAccess: nullableBoolean(detail.canAccess),
    attempts: Math.max(0, Math.trunc(numberOr(detail.attempts, 0))),
    ok: detail.ok,
    error: text(detail.error) ?? null,
    timestamp: Math.max(0, Math.trunc(numberOr(detail.timestamp, Date.now())))
  };
}

export function normalizeProductHostKeySmokeDetail(detail: unknown): ProductHostKeySmokeMetric | null {
  if (!isRecord(detail)) return null;
  const phase = optionalKeyPhase(detail.phase);
  const path = optionalPath(detail.path);
  if (!phase || !path) return null;
  if (detail.signatureScheme !== PRODUCT_SR25519_SIGNATURE_SCHEME) return null;
  if (!isHexString(detail.address) || !isHexString(detail.productPublicKey)) return null;

  return {
    phase,
    path,
    signatureScheme: PRODUCT_SR25519_SIGNATURE_SCHEME,
    address: detail.address,
    productPublicKey: detail.productPublicKey,
    chainId: Math.trunc(numberOr(detail.chainId, 0)),
    purpose: optionalPurpose(detail.purpose),
    contentHash: isHexString(detail.contentHash) ? detail.contentHash : undefined,
    access: optionalAccess(detail.access),
    playbackMode: optionalPlaybackMode(detail.playbackMode),
    runtime: isHexString(detail.runtime) ? detail.runtime : undefined,
    status: optionalNumber(detail.status),
    code: text(detail.code, 80),
    error: text(detail.error) ?? null,
    timestamp: Math.max(0, Math.trunc(numberOr(detail.timestamp, Date.now())))
  };
}

function normalizeOperatorObservation(detail: unknown): ProductCdmHostOperatorObservation | null {
  if (!isRecord(detail)) return null;
  if (detail.kind !== 'operator-observation' || detail.observation !== 'host-approval-explicit' || typeof detail.ok !== 'boolean') return null;
  return {
    kind: 'operator-observation',
    observation: 'host-approval-explicit',
    ok: detail.ok,
    timestamp: Math.max(0, Math.trunc(numberOr(detail.timestamp, Date.now())))
  };
}

function normalizeSmokeEvent(event: unknown): ProductCdmHostSmokeEvent | null {
  if (!isRecord(event)) return null;
  if (event.kind === 'payment') {
    const metric = normalizeProductCdmPaymentSmokeDetail(event);
    return metric ? { kind: 'payment', ...metric } : null;
  }
  if (event.kind === 'key') {
    const metric = normalizeProductHostKeySmokeDetail(event);
    return metric ? { kind: 'key', ...metric } : null;
  }
  return normalizeOperatorObservation(event);
}

export function appendProductCdmHostSmokeEvent(
  events: ProductCdmHostSmokeEvent[],
  event: ProductCdmHostSmokeEvent,
  limit = MAX_STORED_EVENTS
): ProductCdmHostSmokeEvent[] {
  return [...events, event].slice(-limit);
}

export function readProductCdmHostSmokeEvents(storage?: SmokeStorage | null): ProductCdmHostSmokeEvent[] {
  const target = getSmokeStorage(storage);
  if (!target) return [];
  try {
    const raw = target.getItem(PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeSmokeEvent).filter((event): event is ProductCdmHostSmokeEvent => Boolean(event));
  } catch {
    return [];
  }
}

export function recordProductCdmHostSmokeEvent(event: ProductCdmHostSmokeEvent, storage?: SmokeStorage | null): ProductCdmHostSmokeEvent[] {
  const target = getSmokeStorage(storage);
  const previous = readProductCdmHostSmokeEvents(target);
  const next = appendProductCdmHostSmokeEvent(previous, event);
  if (!target) return next;
  try {
    target.setItem(PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Evidence is best-effort diagnostics. The browser event still gives a
    // mounted panel a chance to capture the signal when storage is unavailable.
  }
  return next;
}

export function clearProductCdmHostSmokeEvents(storage?: SmokeStorage | null): void {
  const target = getSmokeStorage(storage);
  if (!target) return;
  try {
    target.removeItem(PRODUCT_CDM_HOST_SMOKE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function dispatchSmokeEvent(eventName: string, detail: unknown): void {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return;
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function shouldLogSmokeMetrics(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.MODE !== 'test');
}

export function publishProductCdmPaymentSmokeMetric(metric: ProductCdmPaymentSmokeMetric): void {
  const normalized = normalizeProductCdmPaymentSmokeDetail(metric);
  if (!normalized) return;
  recordProductCdmHostSmokeEvent({ kind: 'payment', ...normalized });
  dispatchSmokeEvent(PRODUCT_CDM_PAYMENT_SMOKE_EVENT, normalized);
  dispatchSmokeEvent(PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT, { kind: 'payment' });
  if (shouldLogSmokeMetrics()) {
    console.info('[dotify.product-cdm.payment-smoke]', normalized);
  }
}

export function publishProductHostKeySmokeMetric(metric: ProductHostKeySmokeMetric): void {
  const normalized = normalizeProductHostKeySmokeDetail(metric);
  if (!normalized) return;
  recordProductCdmHostSmokeEvent({ kind: 'key', ...normalized });
  dispatchSmokeEvent(PRODUCT_HOST_KEY_SMOKE_EVENT, normalized);
  dispatchSmokeEvent(PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT, { kind: 'key' });
  if (shouldLogSmokeMetrics()) {
    console.info('[dotify.product-host.key-smoke]', normalized);
  }
}

export function recordProductCdmHostApprovalObservation(ok: boolean): ProductCdmHostOperatorObservation {
  const event: ProductCdmHostOperatorObservation = {
    kind: 'operator-observation',
    observation: 'host-approval-explicit',
    ok,
    timestamp: Date.now()
  };
  recordProductCdmHostSmokeEvent(event);
  dispatchSmokeEvent(PRODUCT_CDM_HOST_SMOKE_EVIDENCE_EVENT, event);
  return event;
}

function latestEvent<T extends ProductCdmHostSmokeEvent['kind']>(
  events: ProductCdmHostSmokeEvent[],
  kind: T
): Extract<ProductCdmHostSmokeEvent, { kind: T }> | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === kind) return event as Extract<ProductCdmHostSmokeEvent, { kind: T }>;
  }
  return null;
}

function latestKeyEvent(events: ProductCdmHostSmokeEvent[]): Extract<ProductCdmHostSmokeEvent, { kind: 'key' }> | null {
  return latestEvent(events, 'key');
}

function latestOperatorObservation(events: ProductCdmHostSmokeEvent[]): ProductCdmHostOperatorObservation | null {
  return latestEvent(events, 'operator-observation');
}

function sameAddress(left?: string | null, right?: string | null): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

function paymentReadbackCheck(payment: Extract<ProductCdmHostSmokeEvent, { kind: 'payment' }> | null): ProductCdmHostSmokeCheck {
  if (!payment) {
    return {
      id: 'payment-readback',
      label: 'Payment read-back',
      tone: 'unknown',
      detail: 'No Product CDM payment smoke event has been captured in this browser session.'
    };
  }
  if (payment.ok && payment.hasPaid === true && payment.canAccess === true) {
    return {
      id: 'payment-readback',
      label: 'Payment read-back',
      tone: 'ok',
      detail: `Runtime read-back passed after ${payment.attempts} attempt${payment.attempts === 1 ? '' : 's'} for ${payment.contentHash}.`
    };
  }
  return {
    id: 'payment-readback',
    label: 'Payment read-back',
    tone: 'error',
    detail: payment.error ?? 'Product CDM payment was included, but runtime access was not verified.'
  };
}

function keyReleaseCheck(events: ProductCdmHostSmokeEvent[], payment: Extract<ProductCdmHostSmokeEvent, { kind: 'payment' }> | null): ProductCdmHostSmokeCheck {
  const keys = events.filter((event): event is Extract<ProductCdmHostSmokeEvent, { kind: 'key' }> => event.kind === 'key');
  const latest = keys.length > 0 ? keys[keys.length - 1] : null;
  if (!latest) {
    return {
      id: 'backend-key',
      label: 'Backend key release',
      tone: 'unknown',
      detail: 'No Product sr25519 key/session result has been captured yet.'
    };
  }
  if (latest.phase === 'key-error' || latest.phase === 'key-denied') {
    return {
      id: 'backend-key',
      label: 'Backend key release',
      tone: 'error',
      detail: latest.code ? `${latest.phase} (${latest.code})` : (latest.error ?? latest.phase)
    };
  }
  const matchingAllowedKey = keys.find(
    event =>
      event.phase === 'key-allowed' &&
      (!payment || event.timestamp >= payment.timestamp) &&
      (!payment || (sameAddress(event.address, payment.listenerAddress) && event.contentHash?.toLowerCase() === payment.contentHash.toLowerCase()))
  );
  if (matchingAllowedKey) {
    return {
      id: 'backend-key',
      label: 'Backend key release',
      tone: 'ok',
      detail: `Backend released full access through ${matchingAllowedKey.path} Product sr25519 identity.`
    };
  }
  if (keys.some(event => event.phase === 'key-allowed')) {
    return {
      id: 'backend-key',
      label: 'Backend key release',
      tone: payment ? 'warning' : 'ok',
      detail: payment ? 'A Product sr25519 key request passed, but not yet for the same post-payment track identity.' : 'A Product sr25519 key request passed.'
    };
  }
  return {
    id: 'backend-key',
    label: 'Backend key release',
    tone: 'unknown',
    detail: latest.phase === 'session-created' ? 'Product session opened; play the protected track to capture key release.' : latest.phase
  };
}

export function summarizeProductCdmHostSmokeChecks(context: ProductCdmHostSmokeContext, events: ProductCdmHostSmokeEvent[]): ProductCdmHostSmokeCheck[] {
  const payment = latestEvent(events, 'payment');
  const latestKey = latestKeyEvent(events);
  const latestObservation = latestOperatorObservation(events);
  const eventAddresses = events.flatMap(event => {
    if (event.kind === 'payment') return [event.listenerAddress];
    if (event.kind === 'key') return [event.address];
    return [];
  });
  const hasAddressMismatch =
    Boolean(context.listenerAddress) && eventAddresses.some(address => address.toLowerCase() !== context.listenerAddress?.toLowerCase());

  return [
    {
      id: 'product-account',
      label: 'Product account',
      tone:
        context.walletMethod === 'product-host' && context.listenerAddress && context.productPublicKey
          ? 'ok'
          : context.productHostStatus === 'unavailable'
            ? 'error'
            : 'unknown',
      detail:
        context.walletMethod === 'product-host' && context.listenerAddress && context.productPublicKey
          ? `Connected ${context.listenerAddress} from Product public key ${context.productPublicKey}.`
          : 'Connect with Use Polkadot app inside the Product host before running the smoke.'
    },
    {
      id: 'product-cdm-adapter',
      label: 'Runtime adapter',
      tone: context.runtimeAdapterKind === 'product-cdm' ? 'ok' : 'warning',
      detail:
        context.runtimeAdapterKind === 'product-cdm'
          ? 'This build is using the Product CDM runtime adapter.'
          : `This build is using ${context.runtimeAdapterKind}; rebuild with VITE_DOTIFY_RUNTIME_ADAPTER=product-cdm for write smoke evidence.`
    },
    {
      id: 'host-approval',
      label: 'Host approval',
      tone: latestObservation?.ok ? 'ok' : 'unknown',
      detail: latestObservation?.ok
        ? 'Operator marked the host transaction approval prompt as explicit.'
        : 'Mark this after the Product host shows a transaction approval prompt.'
    },
    {
      id: 'native-value',
      label: 'Native value',
      tone: payment ? (payment.amountPlanck !== '0' ? 'ok' : 'warning') : 'unknown',
      detail: payment ? `Smoke event recorded amountPlanck=${payment.amountPlanck} for musicRoyPayAccess.` : 'No Product CDM payment amount captured yet.'
    },
    paymentReadbackCheck(payment),
    keyReleaseCheck(events, payment),
    {
      id: 'same-identity',
      label: 'Same identity',
      tone: hasAddressMismatch
        ? 'error'
        : eventAddresses.length > 0 && context.listenerAddress && latestKey?.productPublicKey === context.productPublicKey
          ? 'ok'
          : 'unknown',
      detail: hasAddressMismatch
        ? 'At least one captured Product event used a different H160 listener identity than the connected wallet.'
        : eventAddresses.length > 0 && context.listenerAddress
          ? 'Captured Product payment/key events use the connected H160 identity.'
          : 'No Product payment/key identity evidence has been captured yet.'
    }
  ];
}

export function summarizeProductCdmHostSmoke(checks: ProductCdmHostSmokeCheck[]): ProductCdmHostSmokeEvidence['summary'] {
  const problemCount = checks.filter(check => check.tone === 'error').length;
  if (problemCount > 0) return { tone: 'error', label: `${problemCount} failing`, problemCount };
  if (checks.every(check => check.tone === 'ok')) return { tone: 'ok', label: 'Evidence complete', problemCount: 0 };
  const pendingCount = checks.filter(check => check.tone === 'unknown' || check.tone === 'warning').length;
  return { tone: 'warning', label: `${pendingCount} pending`, problemCount: 0 };
}

function sanitizeContext(context: ProductCdmHostSmokeContext): ProductCdmHostSmokeContext {
  return {
    productId: context.productId,
    productHostMode: context.productHostMode,
    productHostStatus: context.productHostStatus,
    runtimeAdapterKind: context.runtimeAdapterKind,
    walletMethod: context.walletMethod,
    listenerAddress: context.listenerAddress,
    substrateAddress: context.substrateAddress,
    productPublicKey: context.productPublicKey,
    expectedChainId: context.expectedChainId,
    apiConfigured: context.apiConfigured
  };
}

export function buildProductCdmHostSmokeEvidence(
  context: ProductCdmHostSmokeContext,
  events: ProductCdmHostSmokeEvent[],
  capturedAt = new Date()
): ProductCdmHostSmokeEvidence {
  const safeContext = sanitizeContext(context);
  const safeEvents = events.map(normalizeSmokeEvent).filter((event): event is ProductCdmHostSmokeEvent => Boolean(event));
  const checks = summarizeProductCdmHostSmokeChecks(safeContext, safeEvents);
  return {
    schemaVersion: 1,
    capturedAt: capturedAt.toISOString(),
    summary: summarizeProductCdmHostSmoke(checks),
    context: safeContext,
    checks,
    events: safeEvents,
    limitations: [
      'This file is browser-side smoke evidence, not a substitute for Product host screenshots or Fly/API logs.',
      'No content keys, signatures, nonces, or session tokens are included.',
      'Host approval visibility is operator-marked because the web app cannot inspect native host UI.'
    ]
  };
}

export function serializeProductCdmHostSmokeEvidence(evidence: ProductCdmHostSmokeEvidence): string {
  return JSON.stringify(evidence, null, 2);
}
