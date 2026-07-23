import { config } from '../../config.js';
import { ViemCatalogChainGateway } from './chain.js';
import { CatalogReadModel } from './readModel.js';
import { JsonCatalogSnapshotStore } from './snapshotStore.js';

const gateway =
  config.PASEO_ASSET_HUB_RPC && config.DOTIFY_DIRECTORY_ADDRESS
    ? new ViemCatalogChainGateway({
        rpcUrl: config.PASEO_ASSET_HUB_RPC,
        chainId: config.DOTIFY_CHAIN_ID,
        directoryAddress: config.DOTIFY_DIRECTORY_ADDRESS as `0x${string}`
      })
    : null;

export const catalogReadModel = new CatalogReadModel({
  gateway,
  store: new JsonCatalogSnapshotStore(config.CATALOG_SNAPSHOT_PATH),
  pollIntervalMs: config.CATALOG_POLL_INTERVAL_MS,
  reconcileIntervalMs: config.CATALOG_RECONCILE_INTERVAL_MS,
  staleAfterMs: config.CATALOG_STALE_AFTER_MS,
  confirmations: config.CATALOG_CONFIRMATIONS
});

export * from './types.js';
export * from './readModel.js';
export * from './snapshotStore.js';
