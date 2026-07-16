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

export type DeploymentMode = 'local' | 'demo' | 'production' | 'invalid';

export type ProductionEnvironmentValidation = {
  mode: DeploymentMode;
  errors: string[];
  warnings: string[];
};

type EnvironmentLike = Record<string, string | boolean | number | null | undefined>;

const DEPLOYMENT_MODE_VALUES = {
  local: new Set(['local', 'development', 'dev']),
  demo: new Set(['demo', 'preview', 'staging', 'test']),
  production: new Set(['production', 'prod'])
} as const;

const PRODUCTION_LOOPBACK_HOSTS = new Set([...LOOPBACK_HOSTS, '0.0.0.0']);

function readEnvironmentValue(env: EnvironmentLike, key: string): string {
  const value = env[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function resolveDeploymentMode(env: EnvironmentLike): DeploymentMode {
  const rawMode = readEnvironmentValue(env, 'VITE_DOTIFY_DEPLOYMENT') || readEnvironmentValue(env, 'DOTIFY_DEPLOYMENT');
  if (!rawMode) return 'demo';

  const normalized = rawMode.toLowerCase();
  if (DEPLOYMENT_MODE_VALUES.production.has(normalized)) return 'production';
  if (DEPLOYMENT_MODE_VALUES.demo.has(normalized)) return 'demo';
  if (DEPLOYMENT_MODE_VALUES.local.has(normalized)) return 'local';
  return 'invalid';
}

function isLoopbackProductionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return PRODUCTION_LOOPBACK_HOSTS.has(normalized) || normalized.endsWith('.local');
}

function validateUrl(
  env: EnvironmentLike,
  key: string,
  options: {
    required?: boolean;
    protocols: string[];
    errors: string[];
  }
): void {
  const value = readEnvironmentValue(env, key);
  if (!value) {
    if (options.required) options.errors.push(`${key} is required when VITE_DOTIFY_DEPLOYMENT=production.`);
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    options.errors.push(`${key} must be an absolute URL.`);
    return;
  }

  if (!options.protocols.includes(parsed.protocol)) {
    options.errors.push(`${key} must use ${options.protocols.join(' or ')} in production.`);
  }

  if (isLoopbackProductionHost(parsed.hostname)) {
    options.errors.push(`${key} must not point at a loopback or .local host in production.`);
  }
}

function validateUrlList(
  env: EnvironmentLike,
  key: string,
  options: {
    required?: boolean;
    protocols: string[];
    errors: string[];
  }
): void {
  const value = readEnvironmentValue(env, key);
  if (!value) {
    if (options.required) options.errors.push(`${key} is required when VITE_DOTIFY_DEPLOYMENT=production.`);
    return;
  }

  for (const entry of value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)) {
    validateUrl({ [key]: entry }, key, options);
  }
}

export function validateProductionEnvironment(env: EnvironmentLike): ProductionEnvironmentValidation {
  const mode = resolveDeploymentMode(env);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (mode === 'invalid') {
    errors.push('VITE_DOTIFY_DEPLOYMENT must be one of local, demo, preview, staging, or production.');
    return { mode, errors, warnings };
  }

  if (mode !== 'production') return { mode, errors, warnings };

  if (readEnvironmentValue(env, 'VITE_PINATA_JWT')) {
    errors.push('VITE_PINATA_JWT is browser-exposed and must not be set for production builds. Configure backend PINATA_JWT instead.');
  }

  if (readEnvironmentValue(env, 'VITE_CONTENT_SECRET')) {
    errors.push('VITE_CONTENT_SECRET is bundled into the browser and must not be set for production builds. Use backend CONTENT_KEY_MASTER_SECRET.');
  }

  validateUrl(env, 'VITE_SIGNAL_URL', { required: true, protocols: ['https:', 'wss:'], errors });
  validateUrl(env, 'VITE_DOTIFY_API_URL', { required: true, protocols: ['https:'], errors });
  validateUrl(env, 'VITE_PINATA_GATEWAY', { required: true, protocols: ['https:'], errors });
  validateUrlList(env, 'VITE_IPFS_READ_GATEWAYS', { required: true, protocols: ['https:'], errors });
  validateUrl(env, 'VITE_ETH_RPC_URL', { protocols: ['https:'], errors });
  validateUrl(env, 'VITE_WS_URL', { protocols: ['wss:'], errors });
  validateUrl(env, 'VITE_BULLETIN_WS_URL', { protocols: ['wss:'], errors });
  validateUrl(env, 'VITE_BLOCKSCOUT_BASE_URL', { protocols: ['https:'], errors });
  validateUrl(env, 'VITE_TURN_URL', { protocols: ['turn:', 'turns:'], errors });

  return { mode, errors, warnings };
}

export function assertProductionEnvironment(env: EnvironmentLike): void {
  const validation = validateProductionEnvironment(env);
  if (validation.errors.length === 0) return;

  throw new Error(['Dotify production environment validation failed:', ...validation.errors.map(error => `- ${error}`)].join('\n'));
}
