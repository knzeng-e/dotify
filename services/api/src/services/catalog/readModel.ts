import { createHash } from 'node:crypto';
import type { CatalogArtist, CatalogChainGateway, CatalogMetadata, CatalogRelease, CatalogSnapshot, DirectoryArtist } from './types.js';
import type { CatalogSnapshotStore } from './snapshotStore.js';

type FailureKind = 'indexer' | 'rpc';

export type CatalogReadModelOptions = {
  gateway: CatalogChainGateway | null;
  store: CatalogSnapshotStore;
  pollIntervalMs: number;
  reconcileIntervalMs: number;
  staleAfterMs: number;
  confirmations: number;
  now?: () => Date;
};

export class CatalogReadModel {
  private readonly gateway;
  private readonly store;
  private readonly pollIntervalMs;
  private readonly reconcileIntervalMs;
  private readonly staleAfterMs;
  private readonly confirmations;
  private readonly now;
  private snapshot: CatalogSnapshot | null = null;
  private failure: { kind: FailureKind; at: string } | null = null;
  private syncInFlight: Promise<CatalogSnapshot> | null = null;
  private timer: NodeJS.Timeout | null = null;
  private started = false;

  constructor(options: CatalogReadModelOptions) {
    this.gateway = options.gateway;
    this.store = options.store;
    this.pollIntervalMs = options.pollIntervalMs;
    this.reconcileIntervalMs = options.reconcileIntervalMs;
    this.staleAfterMs = options.staleAfterMs;
    this.confirmations = options.confirmations;
    this.now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      const loaded = await this.store.load();
      if (loaded && this.matchesGateway(loaded)) this.snapshot = loaded;
    } catch {
      this.recordFailure('indexer');
    }

    if (!this.gateway) {
      this.recordFailure('rpc');
      return;
    }

    if (!this.snapshot) this.recordFailure('indexer');
    void this.sync().catch(() => undefined);
    this.timer = setInterval(() => {
      void this.sync().catch(() => undefined);
    }, this.pollIntervalMs);
    this.timer.unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.started = false;
  }

  async sync(options: { forceReindex?: boolean } = {}): Promise<CatalogSnapshot> {
    if (!this.gateway) {
      this.recordFailure('rpc');
      throw new Error('Catalog chain RPC or directory is not configured');
    }
    if (this.syncInFlight) return this.syncInFlight;

    const operation = this.performSync(options.forceReindex === true).finally(() => {
      if (this.syncInFlight === operation) this.syncInFlight = null;
    });
    this.syncInFlight = operation;
    return operation;
  }

  getSnapshot(): CatalogSnapshot | null {
    return this.snapshot;
  }

  getRevision(): string {
    const content = this.snapshot ? JSON.stringify({ artists: this.snapshot.artists, releases: this.snapshot.releases }) : 'catalog-unavailable';
    return createHash('sha256').update(content).digest('hex');
  }

  getMetadata(): CatalogMetadata {
    const snapshot = this.snapshot;
    const cacheAvailable = snapshot !== null;
    const blockLag = snapshot ? Math.max(0, snapshot.chainHeadBlock - snapshot.lastIndexedBlock) : null;

    let state: CatalogMetadata['state'];
    if (this.failure?.kind === 'indexer') {
      state = 'indexer-outage';
    } else if (this.failure?.kind === 'rpc') {
      state = 'rpc-outage';
    } else if (snapshot && this.now().getTime() - Date.parse(snapshot.indexedAt) > this.staleAfterMs) {
      state = 'stale-cache';
    } else if (snapshot && snapshot.releases.length === 0) {
      state = 'empty';
    } else {
      state = 'fresh';
    }

    return {
      state,
      cacheAvailable,
      indexedAt: snapshot?.indexedAt ?? null,
      lastIndexedBlock: snapshot?.lastIndexedBlock ?? null,
      chainHeadBlock: snapshot?.chainHeadBlock ?? null,
      blockLag,
      staleAfterMs: this.staleAfterMs,
      lastErrorCode: this.failure?.kind === 'indexer' ? 'CATALOG_INDEXER_UNAVAILABLE' : this.failure?.kind === 'rpc' ? 'CHAIN_RPC_UNAVAILABLE' : null
    };
  }

  private async performSync(forceReindex: boolean): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');

    let nextSnapshot: CatalogSnapshot;
    try {
      const chainHeadBlock = await gateway.getHeadBlock();
      const safeHeadBlock = Math.max(0, chainHeadBlock - this.confirmations);
      const current = this.snapshot;

      if (forceReindex || !current || !this.matchesGateway(current) || current.lastIndexedBlock > safeHeadBlock || (await this.checkpointChanged(current))) {
        nextSnapshot = await this.reindex(safeHeadBlock, chainHeadBlock);
      } else {
        const reconciliationDue = this.now().getTime() - Date.parse(current.reconciledAt) >= this.reconcileIntervalMs;
        if (reconciliationDue) {
          nextSnapshot = await this.reindex(safeHeadBlock, chainHeadBlock);
        } else {
          nextSnapshot = await this.applyEvents(current, safeHeadBlock, chainHeadBlock);
        }
      }
    } catch (error) {
      this.recordFailure('rpc');
      throw error;
    }

    try {
      await this.store.save(nextSnapshot);
    } catch (error) {
      this.snapshot = nextSnapshot;
      this.recordFailure('indexer');
      throw error;
    }

    this.snapshot = nextSnapshot;
    this.failure = null;
    return nextSnapshot;
  }

  private async checkpointChanged(snapshot: CatalogSnapshot): Promise<boolean> {
    if (!this.gateway) return true;
    const canonicalHash = await this.gateway.getBlockHash(snapshot.lastIndexedBlock);
    return canonicalHash.toLowerCase() !== snapshot.lastIndexedBlockHash.toLowerCase();
  }

  private async reindex(safeHeadBlock: number, chainHeadBlock: number): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');

    const directoryArtists = await gateway.listArtists();
    const releaseGroups = await Promise.all(
      directoryArtists.map(async artist => {
        const hashes = await gateway.listTrackHashes(artist.runtimeAddress);
        return Promise.all(hashes.map(hash => gateway.readRelease(artist.artistAddress, artist.runtimeAddress, hash)));
      })
    );
    const releases = sortReleases(releaseGroups.flat());
    const checkpointHash = await gateway.getBlockHash(safeHeadBlock);
    const indexedAt = this.now().toISOString();

    return {
      schemaVersion: 1,
      chainId: gateway.identity.chainId,
      directoryAddress: gateway.identity.directoryAddress,
      lastIndexedBlock: safeHeadBlock,
      lastIndexedBlockHash: checkpointHash,
      chainHeadBlock,
      indexedAt,
      reconciledAt: indexedAt,
      artists: buildArtists(directoryArtists, releases),
      releases
    };
  }

  private async applyEvents(current: CatalogSnapshot, safeHeadBlock: number, chainHeadBlock: number): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');

    const changes = await gateway.getChanges(
      current.lastIndexedBlock + 1,
      safeHeadBlock,
      current.artists.map(artist => artist.runtimeAddress as `0x${string}`)
    );
    if (changes.directoryChanged) return this.reindex(safeHeadBlock, chainHeadBlock);

    const artistByRuntime = new Map(current.artists.map(artist => [artist.runtimeAddress.toLowerCase(), artist.artistAddress]));
    if (changes.releases.some(change => !artistByRuntime.has(change.runtimeAddress.toLowerCase()))) {
      return this.reindex(safeHeadBlock, chainHeadBlock);
    }
    const changedReleases = await Promise.all(
      changes.releases.map(async change => {
        const artistAddress = artistByRuntime.get(change.runtimeAddress.toLowerCase());
        if (!artistAddress) throw new Error('Catalog change references an unknown runtime');
        const release = await gateway.readRelease(artistAddress as `0x${string}`, change.runtimeAddress, change.contentHash);
        return { ...release, sourceBlock: change.sourceBlock };
      })
    );

    const releasesById = new Map(current.releases.map(release => [release.id.toLowerCase(), release]));
    for (const release of changedReleases) {
      releasesById.set(release.id.toLowerCase(), release);
    }
    const releases = sortReleases([...releasesById.values()]);
    const directoryArtists: DirectoryArtist[] = current.artists.map(artist => ({
      artistAddress: artist.artistAddress as `0x${string}`,
      runtimeAddress: artist.runtimeAddress as `0x${string}`
    }));
    const checkpointHash = await gateway.getBlockHash(safeHeadBlock);

    return {
      ...current,
      lastIndexedBlock: safeHeadBlock,
      lastIndexedBlockHash: checkpointHash,
      chainHeadBlock,
      indexedAt: this.now().toISOString(),
      artists: buildArtists(directoryArtists, releases),
      releases
    };
  }

  private matchesGateway(snapshot: CatalogSnapshot): boolean {
    if (!this.gateway) return false;
    return (
      snapshot.chainId === this.gateway.identity.chainId && snapshot.directoryAddress.toLowerCase() === this.gateway.identity.directoryAddress.toLowerCase()
    );
  }

  private recordFailure(kind: FailureKind): void {
    this.failure = { kind, at: this.now().toISOString() };
  }
}

function sortReleases(releases: CatalogRelease[]): CatalogRelease[] {
  return [...releases].sort((left, right) => {
    if (left.registeredAtBlock !== right.registeredAtBlock) {
      return right.registeredAtBlock - left.registeredAtBlock;
    }
    const byTitle = left.title.localeCompare(right.title);
    return byTitle !== 0 ? byTitle : left.id.localeCompare(right.id);
  });
}

function buildArtists(directoryArtists: DirectoryArtist[], releases: CatalogRelease[]): CatalogArtist[] {
  return directoryArtists.map(entry => {
    const owned = releases.filter(release => release.runtimeAddress.toLowerCase() === entry.runtimeAddress.toLowerCase());
    return {
      artistAddress: entry.artistAddress,
      runtimeAddress: entry.runtimeAddress,
      name: owned[0]?.artist || entry.artistAddress,
      releaseCount: owned.length,
      activeReleaseCount: owned.filter(release => release.active).length,
      latestReleaseBlock: owned.reduce((latest, release) => Math.max(latest, release.registeredAtBlock), 0)
    };
  });
}
