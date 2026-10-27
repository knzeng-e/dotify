import { config } from '../../config.js';
import { PostgresState } from './postgres.js';

export const sharedState = config.STATE_STORE === 'postgres' ? new PostgresState(config.STATE_NAMESPACE, config.DATABASE_URL ?? '') : undefined;

export async function assertSharedState(): Promise<void> {
  if (!sharedState) {
    if (config.API_ROLE !== 'combined') throw new Error('Edge/custody roles require PostgreSQL shared state');
    return;
  }
  if (!config.DATABASE_URL || !config.SESSION_EPOCH || !config.SESSION_SECRET || config.API_ROLE === 'combined')
    throw new Error('Shared mode requires DATABASE_URL, SESSION_SECRET, SESSION_EPOCH and an explicit edge/custody role');
  if (Boolean(config.SESSION_PREVIOUS_SECRET) !== Boolean(config.SESSION_PREVIOUS_SECRET_UNTIL))
    throw new Error('Configure the previous session secret with its explicit deadline');
  if (config.SESSION_PREVIOUS_SECRET_UNTIL && Date.parse(config.SESSION_PREVIOUS_SECRET_UNTIL) > Date.now() + 24 * 60 * 60_000)
    throw new Error('Previous session secret overlap must be bounded to 24 hours');
  await sharedState.assertIdentity({
    version: 1,
    chainId: config.DOTIFY_CHAIN_ID,
    directory: config.DOTIFY_DIRECTORY_ADDRESS?.toLowerCase() ?? '',
    sessionEpoch: config.SESSION_EPOCH
  });
}
