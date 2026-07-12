import {
  encodeFunctionData,
  getAddress,
  isAddress,
  keccak256,
  toBytes,
  toFunctionSelector,
  zeroAddress,
  type Abi,
  type AbiFunction,
  type Address,
  type Hex
} from 'viem';

export const MUSIC_REGISTRY_REGISTER_SELECTOR = '0xfcb6cd7e' as const;
export const FACET_CUT_REPLACE = 1 as const;

export type RegistrySelector = {
  name: string;
  selector: Hex;
};

export type RegistryHotfixTransaction = {
  to: Address;
  value: '0x0';
  data: Hex;
};

export type RegistryRuntimeSafetyInput = {
  registerFacetMatchesSource: boolean;
  ownerMatchesDirectoryArtist: boolean;
  guardStatus: 'protected' | 'vulnerable' | 'inconclusive';
  foreignTrackCount: number;
  selectorRoutes: Array<{ facet: Address; codeHash: Hex | null }>;
};

export function requireAddress(label: string, value: string): Address {
  if (!isAddress(value)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }
  return getAddress(value);
}

export function registrySelectorsFromAbi(abi: Abi): RegistrySelector[] {
  return abi
    .filter((item): item is AbiFunction => item.type === 'function')
    .map(item => ({ name: item.name, selector: toFunctionSelector(item) }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function assertRegistryArtifact(abi: Abi): RegistrySelector[] {
  const selectors = registrySelectorsFromAbi(abi);
  const register = selectors.find(item => item.name === 'musicRegRegister');
  if (!register || register.selector.toLowerCase() !== MUSIC_REGISTRY_REGISTER_SELECTOR) {
    throw new Error(`MusicRegistryPallet ABI does not expose the expected musicRegRegister selector ${MUSIC_REGISTRY_REGISTER_SELECTOR}.`);
  }
  return selectors;
}

export function buildRegistryHotfixCalldata(diamondCutAbi: Abi, targetFacet: Address): Hex {
  return encodeFunctionData({
    abi: diamondCutAbi,
    functionName: 'diamondCut',
    args: [
      [
        {
          facetAddress: targetFacet,
          action: FACET_CUT_REPLACE,
          functionSelectors: [MUSIC_REGISTRY_REGISTER_SELECTOR]
        }
      ],
      zeroAddress,
      '0x'
    ]
  });
}

export function buildRegistryHotfixTransaction(diamondCutAbi: Abi, runtime: Address, targetFacet: Address): RegistryHotfixTransaction {
  return {
    to: runtime,
    value: '0x0',
    data: buildRegistryHotfixCalldata(diamondCutAbi, targetFacet)
  };
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonical(value));
}

export function hashCanonical(value: unknown): Hex {
  return keccak256(toBytes(canonicalJson(value)));
}

export function registryUpgradePlanDigest<T extends { capturedBlockNumber: string; capturedBlockHash: Hex }>(plan: T): Hex {
  // Capture coordinates remain in the evidence, but excluding them from the
  // confirmation digest lets an owner reproduce the same unchanged plan at a
  // later block. Every stateful/security-relevant field stays bound.
  const { capturedBlockNumber: _capturedBlockNumber, capturedBlockHash: _capturedBlockHash, ...confirmation } = plan;
  return hashCanonical(confirmation);
}

export function isRegistryRuntimeSafe(audit: RegistryRuntimeSafetyInput, expectedSelectorCount: number): boolean {
  return (
    audit.registerFacetMatchesSource &&
    audit.ownerMatchesDirectoryArtist &&
    audit.guardStatus === 'protected' &&
    audit.foreignTrackCount === 0 &&
    audit.selectorRoutes.length === expectedSelectorCount &&
    audit.selectorRoutes.every(route => route.facet !== zeroAddress && route.codeHash !== null)
  );
}

function normalizeCanonical(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeCanonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalizeCanonical(nested)])
    );
  }
  return value;
}
