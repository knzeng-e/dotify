import { CatalogBoundsError } from './bounds.js';
import { createHash } from 'node:crypto';
import { catalogContent } from './content.js';
import { concurrencyGate, mapConcurrent } from './concurrency.js';
import { createDeadline } from '../deadline.js';
import { CatalogRuntimeReadError, mapRuntimeReads, runtimeReadPolicy } from './runtimePolicy.js';
import type { CatalogArtist, CatalogChainGateway, CatalogMetadata, CatalogRelease, CatalogSnapshot, DirectoryArtist } from './types.js';
import type { CatalogSnapshotStore } from './snapshotStore.js';

type RuntimeScan = {
  releases: CatalogRelease[];
  excludedReleases: NonNullable<CatalogSnapshot['excludedReleases']>;
  excludedRuntimes: NonNullable<CatalogSnapshot['excludedRuntimes']>;
};

type FailureKind = 'indexer' | 'rpc';

export type CatalogReadModelOptions = {
  gateway: CatalogChainGateway | null;
  store: CatalogSnapshotStore;
  pollIntervalMs: number;
  reconcileIntervalMs: number;
  staleAfterMs: number;
  confirmations: number;
  now?: () => Date;
  readConcurrency?: number;
  logBlockRange?: number;
  runtimeScanTimeoutMs?: number;
  onSnapshot?: (snapshot: CatalogSnapshot) => void;
};

export class CatalogReadModel {
  private readonly gateway;
  private readonly store;
  private readonly pollIntervalMs;
  private readonly reconcileIntervalMs;
  private readonly staleAfterMs;
  private readonly confirmations;
  private readonly now;
  private readonly onSnapshot;
  private readonly readConcurrency;
  private readonly logBlockRange;
  private readonly reads;
  private readonly runtimeScanTimeoutMs;
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
    this.onSnapshot = options.onSnapshot;
    this.readConcurrency = options.readConcurrency ?? 8;
    this.logBlockRange = options.logBlockRange ?? 1000;
    this.reads = concurrencyGate(this.readConcurrency);
    this.runtimeScanTimeoutMs = options.runtimeScanTimeoutMs ?? runtimeReadPolicy.scanTimeoutMs;
    if (!Number.isFinite(this.runtimeScanTimeoutMs) || this.runtimeScanTimeoutMs < 1) throw new Error('Invalid runtime scan deadline');
    if (!Number.isInteger(this.logBlockRange) || this.logBlockRange < 1 || !Number.isInteger(this.readConcurrency) || this.readConcurrency < 1)
      throw new Error('Invalid catalog work bounds');
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    try {
      const before = this.snapshot;
      const loaded = await this.store.load();
      if (this.snapshot === before && loaded && this.matchesGateway(loaded)) this.snapshot = loaded;
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

    const operation = this.synchronize(options.forceReindex === true).finally(() => {
      if (this.syncInFlight === operation) this.syncInFlight = null;
    });
    this.syncInFlight = operation;
    return operation;
  }

  /** Shared catalog HTTP reads use the committed checkpoint on every replica.
   * During an outage a previous public snapshot may remain readable, explicitly
   * marked stale/unavailable. It never grants content-key authority. */
  async refresh(): Promise<void> {
    if (!this.store.asWriter) return;
    try {
      const before = this.snapshot;
      const loaded = await this.store.load();
      if (this.snapshot === before && loaded && this.matchesGateway(loaded)) this.snapshot = loaded;
    } catch {
      this.recordFailure('indexer');
    }
  }

  getSnapshot(): CatalogSnapshot | null {
    return this.snapshot;
  }

  getRevision(): string {
    return this.snapshot ? catalogContent(this.snapshot).revision : createHash('sha256').update('catalog-unavailable').digest('hex');
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
    } else if (snapshot?.catchingUp) {
      state = 'stale-cache';
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
      ...(snapshot?.excludedReleases?.length ? { excludedReleaseCount: snapshot.excludedReleases.length } : {}),
      ...(snapshot?.excludedRuntimes?.length ? { excludedRuntimeCount: snapshot.excludedRuntimes.length } : {}),
      lastErrorCode: this.failure?.kind === 'indexer' ? 'CATALOG_INDEXER_UNAVAILABLE' : this.failure?.kind === 'rpc' ? 'CHAIN_RPC_UNAVAILABLE' : null
    };
  }

  private async synchronize(forceReindex: boolean): Promise<CatalogSnapshot> {
    if (!this.store.asWriter) return this.performSync(forceReindex);
    let indexing = false;
    try {
      const elected = await this.store.asWriter(async () => {
        const loaded = await this.store.load();
        if (loaded && this.matchesGateway(loaded)) this.snapshot = loaded;
        indexing = true;
        return this.performSync(forceReindex);
      });
      if (elected.elected) return elected.value;
      const loaded = await this.store.load();
      if (!loaded || !this.matchesGateway(loaded)) throw new Error('Catalog checkpoint not yet available');
      this.snapshot = loaded;
      this.failure = null;
      return loaded;
    } catch (error) {
      if (!indexing || this.failure?.kind !== 'rpc') this.recordFailure('indexer');
      throw error;
    }
  }

  private async performSync(forceReindex: boolean): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');
    let storageFailure = false;
    const commit = async (snapshot: CatalogSnapshot) => {
      try {
        return await this.commit(snapshot);
      } catch (error) {
        storageFailure = true;
        throw error;
      }
    };
    try {
      const chainHeadBlock = await gateway.getHeadBlock();
      const safeHeadBlock = Math.max(0, chainHeadBlock - this.confirmations);
      const current = this.snapshot;
      if (forceReindex || !current || !this.matchesGateway(current) || current.lastIndexedBlock > safeHeadBlock || (await this.checkpointChanged(current))) {
        return await commit(await this.reindex(safeHeadBlock, chainHeadBlock));
      }
      let next = current;
      // Commit each complete range, even if a later RPC/read fails. A restart
      // resumes from this range and never skips its unapplied release events.
      for (let from = current.lastIndexedBlock + 1; from <= safeHeadBlock; from += this.logBlockRange) {
        const to = Math.min(safeHeadBlock, from + this.logBlockRange - 1);
        next = await commit({ ...(await this.applyEvents(next, to, chainHeadBlock)), catchingUp: to < safeHeadBlock });
      }
      if (this.now().getTime() - Date.parse(next.reconciledAt) >= this.reconcileIntervalMs) {
        // releaseCount covers accepted releases only. An entirely excluded
        // runtime still needs reconciliation to retain diagnostics and discover
        // corrections made without a recognized release event.
        const excludedRuntimes = new Set([
          ...(next.excludedReleases ?? []).map(release => release.id.split(':', 1)[0].toLowerCase()),
          ...(next.excludedRuntimes ?? []).map(runtime => runtime.runtimeAddress.toLowerCase())
        ]);
        const empty = new Set(
          next.artists
            .filter(artist => artist.releaseCount === 0 && !excludedRuntimes.has(artist.runtimeAddress.toLowerCase()))
            .map(artist => artist.runtimeAddress.toLowerCase())
        );
        next = await commit(await this.reindex(safeHeadBlock, chainHeadBlock, empty));
      } else if (next === current) {
        next = await commit({ ...current, chainHeadBlock, indexedAt: this.now().toISOString() });
      }
      return next;
    } catch (error) {
      if (!storageFailure) this.recordFailure('rpc');
      throw error;
    }
  }

  private async commit(candidate: CatalogSnapshot): Promise<CatalogSnapshot> {
    const current = this.snapshot;
    const changed = !current || catalogContent(current).revision !== catalogContent(candidate).revision;
    const next = changed ? candidate : { ...candidate, artists: current!.artists, releases: current!.releases };
    try {
      if (!changed && this.store.saveProgress) await this.store.saveProgress(next);
      else await this.store.save(next);
    } catch (error) {
      this.recordFailure('indexer');
      throw error;
    }
    this.snapshot = next;
    this.failure = null;
    // Repeated observations replenish bounded warming and propagation retries,
    // including after restart. Persisting unchanged content still stays cheap.
    try {
      this.onSnapshot?.(next);
    } catch {
      /* best-effort acceleration */
    }
    return next;
  }

  private async checkpointChanged(snapshot: CatalogSnapshot): Promise<boolean> {
    if (!this.gateway) return true;
    const canonicalHash = await this.gateway.getBlockHash(snapshot.lastIndexedBlock);
    return canonicalHash.toLowerCase() !== snapshot.lastIndexedBlockHash.toLowerCase();
  }

  private async reindex(safeHeadBlock: number, chainHeadBlock: number, knownEmpty = new Set<string>()): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');

    const expectedHash = await gateway.getBlockHash(safeHeadBlock);
    const directoryArtists = await gateway.listArtists(safeHeadBlock);
    const results = await mapConcurrent(directoryArtists, this.readConcurrency, artist =>
      knownEmpty.has(artist.runtimeAddress.toLowerCase())
        ? Promise.resolve({ releases: [], excludedReleases: [], excludedRuntimes: [] } as RuntimeScan)
        : this.scanRuntime(artist, safeHeadBlock)
    );
    const releases = sortReleases(results.flatMap(result => result.releases));
    const excludedReleases = results.flatMap(result => result.excludedReleases);
    const excludedRuntimes = results.flatMap(result => result.excludedRuntimes);
    const checkpointHash = await gateway.getBlockHash(safeHeadBlock);
    if (checkpointHash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Catalog checkpoint changed during indexing');
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
      excludedReleases,
      excludedRuntimes,
      artists: buildArtists(directoryArtists, releases),
      releases
    };
  }

  private async applyEvents(current: CatalogSnapshot, safeHeadBlock: number, chainHeadBlock: number): Promise<CatalogSnapshot> {
    const gateway = this.gateway;
    if (!gateway) throw new Error('Catalog gateway unavailable');

    const expectedHash = await gateway.getBlockHash(safeHeadBlock);
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
    const grouped = new Map<string, typeof changes.releases>();
    for (const change of changes.releases) {
      const key = change.runtimeAddress.toLowerCase();
      const group = grouped.get(key) ?? [];
      group.push(change);
      grouped.set(key, group);
    }
    const quarantined = new Set((current.excludedRuntimes ?? []).map(item => item.runtimeAddress.toLowerCase()));
    const changedRuntimes = await mapConcurrent([...grouped], this.readConcurrency, async ([key, events]) => {
      const runtimeAddress = events[0]!.runtimeAddress;
      const artistAddress = artistByRuntime.get(key)! as `0x${string}`;
      // A repaired runtime must supply its entire inventory before readmission.
      const full = quarantined.has(key);
      const result = await this.scanRuntime({ artistAddress, runtimeAddress }, safeHeadBlock, full ? undefined : events.map(event => event.contentHash));
      const blocks = new Map(events.map(event => [event.contentHash.toLowerCase(), event.sourceBlock]));
      return {
        key,
        full,
        ...result,
        releases: result.releases.map(release => ({
          ...release,
          sourceBlock: blocks.get(release.hash.toLowerCase()) ?? release.sourceBlock
        }))
      };
    });

    if (await this.checkpointChanged(current)) throw new Error('Catalog checkpoint changed during event replay');
    const actualHash = await gateway.getBlockHash(safeHeadBlock);
    if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Catalog checkpoint changed during indexing');
    if (changedRuntimes.length === 0)
      return {
        ...current,
        lastIndexedBlock: safeHeadBlock,
        lastIndexedBlockHash: actualHash,
        chainHeadBlock,
        indexedAt: this.now().toISOString()
      };
    const releasesById = new Map(current.releases.map(release => [release.id.toLowerCase(), release]));
    const excluded = new Map((current.excludedReleases ?? []).map(item => [item.id.toLowerCase(), item]));
    const excludedRuntimes = new Map((current.excludedRuntimes ?? []).map(item => [item.runtimeAddress.toLowerCase(), item]));
    for (const result of changedRuntimes) {
      if (result.full || result.excludedRuntimes.length) {
        for (const [id, release] of releasesById) if (release.runtimeAddress.toLowerCase() === result.key) releasesById.delete(id);
        for (const id of excluded.keys()) if (id.startsWith(`${result.key}:`)) excluded.delete(id);
      }
      excludedRuntimes.delete(result.key);
      for (const item of result.excludedRuntimes) excludedRuntimes.set(result.key, item);
      for (const release of result.releases) {
        releasesById.set(release.id.toLowerCase(), release);
        excluded.delete(release.id.toLowerCase());
      }
      for (const item of result.excludedReleases) {
        releasesById.delete(item.id.toLowerCase());
        excluded.set(item.id.toLowerCase(), item);
      }
    }
    const releases = sortReleases([...releasesById.values()]);
    const directoryArtists: DirectoryArtist[] = current.artists.map(artist => ({
      artistAddress: artist.artistAddress as `0x${string}`,
      runtimeAddress: artist.runtimeAddress as `0x${string}`
    }));
    const checkpointHash = await gateway.getBlockHash(safeHeadBlock);
    if (checkpointHash.toLowerCase() !== expectedHash.toLowerCase()) throw new Error('Catalog checkpoint changed during indexing');

    return {
      ...current,
      excludedReleases: [...excluded.values()],
      excludedRuntimes: [...excludedRuntimes.values()].sort((a, b) => a.runtimeAddress.toLowerCase().localeCompare(b.runtimeAddress.toLowerCase())),
      lastIndexedBlock: safeHeadBlock,
      lastIndexedBlockHash: checkpointHash,
      chainHeadBlock,
      indexedAt: this.now().toISOString(),
      artists: buildArtists(directoryArtists, releases),
      releases
    };
  }

  private async scanRuntime(artist: DirectoryArtist, block: number, changedHashes?: `0x${string}`[]): Promise<RuntimeScan> {
    const deadline = createDeadline(new AbortController().signal, this.runtimeScanTimeoutMs);
    const signal = deadline.signal;
    const runtime = artist.runtimeAddress;
    try {
      const inventory = await this.reads(() => {
        if (signal.aborted) throw new CatalogRuntimeReadError(runtime, 'scan-deadline');
        return this.gateway!.listTrackHashes(runtime, block, signal);
      });
      if (inventory.length > runtimeReadPolicy.maxTracks || (changedHashes?.length ?? 0) > runtimeReadPolicy.maxTracks)
        throw new CatalogRuntimeReadError(runtime, 'track-limit');
      const results = await mapRuntimeReads(changedHashes ?? inventory, this.readConcurrency, hash =>
        this.reads(() => {
          if (signal.aborted) throw new CatalogRuntimeReadError(runtime, 'scan-deadline');
          return this.readBoundedRelease(artist.artistAddress, runtime, hash, block, signal);
        })
      );
      if (signal.aborted) throw new CatalogRuntimeReadError(runtime, 'scan-deadline');
      return {
        releases: results.flatMap(result => (result.release ? [result.release] : [])),
        excludedReleases: results.flatMap(result => (result.excluded ? [result.excluded] : [])),
        excludedRuntimes: []
      };
    } catch (error) {
      if (!(error instanceof CatalogRuntimeReadError) || error.runtimeAddress.toLowerCase() !== runtime.toLowerCase()) throw error;
      return { releases: [], excludedReleases: [], excludedRuntimes: [{ runtimeAddress: runtime, code: error.code, reason: error.message }] };
    } finally {
      deadline.dispose();
    }
  }

  private async readBoundedRelease(
    artist: `0x${string}`,
    runtime: `0x${string}`,
    hash: `0x${string}`,
    block: number,
    signal: AbortSignal
  ): Promise<{
    release?: CatalogRelease;
    excluded?: { id: string; reason: string };
  }> {
    try {
      return { release: await this.gateway!.readRelease(artist, runtime, hash, block, signal) };
    } catch (error) {
      if (!(error instanceof CatalogBoundsError)) throw error;
      return { excluded: { id: `${runtime}:${hash}`, reason: error.reason } };
    }
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
  const groups = new Map<string, { name: string; count: number; active: number; latest: number }>();
  for (const release of releases) {
    const key = release.runtimeAddress.toLowerCase();
    const group = groups.get(key) ?? { name: release.artist, count: 0, active: 0, latest: 0 };
    group.count++;
    if (release.active) group.active++;
    group.latest = Math.max(group.latest, release.registeredAtBlock);
    groups.set(key, group);
  }
  return directoryArtists.map(entry => {
    const owned = groups.get(entry.runtimeAddress.toLowerCase());
    return {
      artistAddress: entry.artistAddress,
      runtimeAddress: entry.runtimeAddress,
      name: owned?.name || entry.artistAddress,
      releaseCount: owned?.count ?? 0,
      activeReleaseCount: owned?.active ?? 0,
      latestReleaseBlock: owned?.latest ?? 0
    };
  });
}
