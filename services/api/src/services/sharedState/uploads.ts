import { z } from 'zod';
import {
  createUploadAuthorizationService,
  type Reservation,
  type Usage,
  type UploadAuthorizationServiceOptions,
  type SyncUploadAuthorizationService,
  type UploadPurpose,
  type UploadLeaseResult
} from '../uploadAuthorizations.js';
import { PostgresState } from './postgres.js';
type State = { reservations: [string, Reservation][]; usage: Usage[] };
const nonnegative = z.number().int().nonnegative().safe();
const account = z.string().regex(/^0x[0-9a-f]{40}$/);
const stateSchema = z
  .object({
    reservations: z
      .array(
        z.tuple([
          z.string(),
          z.object({
            payload: z.object({
              address: account,
              runtimeAddress: account,
              chainId: nonnegative.positive(),
              purpose: z.enum(['audio', 'cover', 'metadata']),
              maxBytes: nonnegative.positive(),
              jti: z.string().uuid(),
              epoch: z.string().min(1).max(128),
              iat: nonnegative,
              exp: nonnegative
            }),
            state: z.enum(['reserved', 'active']),
            leaseUntil: nonnegative.optional()
          })
        ])
      )
      .max(4096),
    usage: z.array(z.object({ address: account, bytes: nonnegative, expiresAt: nonnegative })).max(16384)
  })
  .strict();
export class PostgresUploadAuthorizations {
  constructor(
    private store: PostgresState,
    private options: UploadAuthorizationServiceOptions
  ) {}
  private async mutate<T>(work: (service: SyncUploadAuthorizationService) => T): Promise<T> {
    return this.store.document<State, T>(
      'uploads-v1',
      () => {
        throw new Error('Upload accounting is missing; restore it before publishing');
      },
      (state, now) => {
        const parsed = stateSchema.parse(state);
        const memory = { reservations: new Map(parsed.reservations as State['reservations']), usage: parsed.usage };
        const result = work(createUploadAuthorizationService({ ...this.options, state: memory, now: () => now }));
        state.reservations = [...memory.reservations];
        state.usage = memory.usage;
        return result;
      }
    );
  }
  async issue(input: Parameters<SyncUploadAuthorizationService['issue']>[0]) {
    return this.mutate(service => service.issue(input));
  }
  async begin(token: string, purpose: UploadPurpose): Promise<UploadLeaseResult> {
    const result = await this.mutate(service => service.begin(token, purpose));
    if (!result.ok) return result;
    const payload = result.lease.payload;
    return {
      ok: true,
      lease: {
        payload,
        complete: bytes => this.mutate(service => service.settleActive(payload.jti, bytes)),
        abort: async () => {
          await this.mutate(service => service.settleActive(payload.jti));
        }
      }
    };
  }
}
