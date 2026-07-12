import { deployments } from './deployments';

export const registryOwnerGuardAttestation = {
  chainId: 420420417,
  factory: '0x9337287a194dfd8b53939eee1890b3f4ec0f8b0d',
  directory: '0xda2761fea6f0871ed44ec719860fddb51b115be8',
  auditedBlock: 10_904_607,
  auditedBlockHash: '0x7eacbb1e0ee963a8e732239990403c4836e56d64af8151b830eb341ba3c505af',
  factoryDirectoryPairingVerified: true,
  existingRuntimeCoverage: { protected: 0, total: 0 },
  existingTrackAudit: { ownerMatched: 0, total: 0 },
  pendingRuntimeDiscoveryComplete: true,
  pendingRuntimeCount: 0,
  futureFactoryUsesOwnerGuard: true,
  correctedRegistryCodeHash: '0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788',
  futureFactoryRegistryCodeHash: '0xa509d4ccc5206974069bb858faba07e42b1f7b9b3fd217adc7bb40a8f714d788',
  catalogCutoverReady: true
} as const;

export type ArtistPublicationSafetyInput = {
  explicitE2e: boolean;
  rpcUrl: string;
  currentChainId: number | null;
  expectedChainId: number;
  configuredFactory: string | undefined;
  configuredDirectory: string | undefined;
  attestedFactory: string;
  attestedDirectory: string;
  auditedBlock: number;
  auditedBlockHash: string | null;
  factoryDirectoryPairingVerified: boolean;
  protectedRuntimeCount: number;
  totalRuntimeCount: number;
  ownerMatchedTrackCount: number;
  totalTrackCount: number;
  pendingRuntimeDiscoveryComplete: boolean;
  pendingRuntimeCount: number;
  futureFactoryUsesOwnerGuard: boolean;
  correctedRegistryCodeHash: string;
  futureFactoryRegistryCodeHash: string | null;
  catalogCutoverReady: boolean;
};

export type ArtistPublicationSafety = {
  quarantined: boolean;
  reason: string;
};

export const ARTIST_PUBLICATION_QUARANTINE_MESSAGE =
  'Artist publishing is temporarily paused because the configured Paseo deployment is not covered by the checked-in owner-guard attestation. Existing listening, rooms, and release controls remain available.';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isLoopbackRpcUrl(rpcUrl: string): boolean {
  try {
    return LOOPBACK_HOSTS.has(new URL(rpcUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

function normalizedAddress(address: string | undefined): string {
  return address?.trim().toLowerCase() ?? '';
}

export function resolveArtistPublicationSafety(input: ArtistPublicationSafetyInput): ArtistPublicationSafety {
  const chainResolved = Number.isSafeInteger(input.currentChainId);
  const verifiedLocalChain = isLoopbackRpcUrl(input.rpcUrl) && chainResolved && input.currentChainId !== null && input.currentChainId !== input.expectedChainId;

  if (input.explicitE2e || verifiedLocalChain) return { quarantined: false, reason: '' };

  const chainMatches = chainResolved && input.currentChainId === input.expectedChainId;
  const addressesMatch =
    normalizedAddress(input.configuredFactory) === normalizedAddress(input.attestedFactory) &&
    normalizedAddress(input.configuredDirectory) === normalizedAddress(input.attestedDirectory);
  const freshCatalogCutover =
    input.catalogCutoverReady &&
    input.totalRuntimeCount === 0 &&
    input.protectedRuntimeCount === 0 &&
    input.totalTrackCount === 0 &&
    input.ownerMatchedTrackCount === 0;
  const existingRuntimesProtected =
    freshCatalogCutover ||
    (Number.isSafeInteger(input.totalRuntimeCount) &&
      input.totalRuntimeCount > 0 &&
      Number.isSafeInteger(input.protectedRuntimeCount) &&
      input.protectedRuntimeCount === input.totalRuntimeCount);
  const existingTracksAudited =
    freshCatalogCutover ||
    (Number.isSafeInteger(input.totalTrackCount) &&
      input.totalTrackCount > 0 &&
      Number.isSafeInteger(input.ownerMatchedTrackCount) &&
      input.ownerMatchedTrackCount === input.totalTrackCount);
  const auditedBlockHashComplete = /^0x[0-9a-f]{64}$/i.test(input.auditedBlockHash ?? '');
  const futureFactoryCodeHashMatches =
    /^0x[0-9a-f]{64}$/i.test(input.correctedRegistryCodeHash) &&
    input.futureFactoryRegistryCodeHash?.toLowerCase() === input.correctedRegistryCodeHash.toLowerCase();
  const auditEvidenceComplete =
    Number.isSafeInteger(input.auditedBlock) &&
    input.auditedBlock > 0 &&
    auditedBlockHashComplete &&
    input.factoryDirectoryPairingVerified &&
    input.pendingRuntimeDiscoveryComplete &&
    Number.isSafeInteger(input.pendingRuntimeCount) &&
    input.pendingRuntimeCount === 0;
  const safe =
    chainMatches &&
    addressesMatch &&
    existingRuntimesProtected &&
    existingTracksAudited &&
    auditEvidenceComplete &&
    input.futureFactoryUsesOwnerGuard &&
    futureFactoryCodeHashMatches &&
    input.catalogCutoverReady;

  return safe ? { quarantined: false, reason: '' } : { quarantined: true, reason: ARTIST_PUBLICATION_QUARANTINE_MESSAGE };
}

export function resolveConfiguredArtistPublicationSafety(input: {
  explicitE2e: boolean;
  rpcUrl: string;
  currentChainId: number | null;
}): ArtistPublicationSafety {
  return resolveArtistPublicationSafety({
    ...input,
    expectedChainId: registryOwnerGuardAttestation.chainId,
    configuredFactory: deployments.factory,
    configuredDirectory: deployments.directory,
    attestedFactory: registryOwnerGuardAttestation.factory,
    attestedDirectory: registryOwnerGuardAttestation.directory,
    auditedBlock: registryOwnerGuardAttestation.auditedBlock,
    auditedBlockHash: registryOwnerGuardAttestation.auditedBlockHash,
    factoryDirectoryPairingVerified: registryOwnerGuardAttestation.factoryDirectoryPairingVerified,
    protectedRuntimeCount: registryOwnerGuardAttestation.existingRuntimeCoverage.protected,
    totalRuntimeCount: registryOwnerGuardAttestation.existingRuntimeCoverage.total,
    ownerMatchedTrackCount: registryOwnerGuardAttestation.existingTrackAudit.ownerMatched,
    totalTrackCount: registryOwnerGuardAttestation.existingTrackAudit.total,
    pendingRuntimeDiscoveryComplete: registryOwnerGuardAttestation.pendingRuntimeDiscoveryComplete,
    pendingRuntimeCount: registryOwnerGuardAttestation.pendingRuntimeCount,
    futureFactoryUsesOwnerGuard: registryOwnerGuardAttestation.futureFactoryUsesOwnerGuard,
    correctedRegistryCodeHash: registryOwnerGuardAttestation.correctedRegistryCodeHash,
    futureFactoryRegistryCodeHash: registryOwnerGuardAttestation.futureFactoryRegistryCodeHash,
    catalogCutoverReady: registryOwnerGuardAttestation.catalogCutoverReady
  });
}
