import { describe, expect, it } from 'vitest';
import {
  buildHealthUrl,
  displayEndpoint,
  isProductionReadinessPanelEnabled,
  pickIpfsProbeRef,
  summarizeReadiness,
  type ReadinessCheck
} from './productionReadiness';
import type { CatalogTrack } from '../../shared/types';

const baseCheck: ReadinessCheck = {
  id: 'backend',
  label: 'Backend',
  target: 'api',
  tone: 'ok',
  detail: 'ready'
};

const track = {
  metadataRef: 'ipfs://QmManifest',
  imageRef: 'https://gateway.example/ipfs/QmCover',
  audioRef: 'dotify:enc:ipfs://QmAudio'
} as CatalogTrack;

describe('isProductionReadinessPanelEnabled', () => {
  it('requires an explicit true flag', () => {
    expect(isProductionReadinessPanelEnabled({ VITE_DOTIFY_DEBUG_PANEL: 'true' })).toBe(true);
    expect(isProductionReadinessPanelEnabled({ VITE_DOTIFY_DEBUG_PANEL: 'TRUE' })).toBe(true);
    expect(isProductionReadinessPanelEnabled({ VITE_DOTIFY_DEBUG_PANEL: 'false' })).toBe(false);
    expect(isProductionReadinessPanelEnabled({})).toBe(false);
  });
});

describe('summarizeReadiness', () => {
  it('prioritizes error over warning and ok states', () => {
    expect(summarizeReadiness([baseCheck, { ...baseCheck, id: 'ipfs', tone: 'warning' }, { ...baseCheck, id: 'rpc', tone: 'error' }])).toEqual({
      tone: 'error',
      label: 'Needs attention',
      problemCount: 2
    });
  });

  it('reports ready only when every check is ok', () => {
    expect(summarizeReadiness([baseCheck, { ...baseCheck, id: 'signal' }])).toEqual({
      tone: 'ok',
      label: 'Ready',
      problemCount: 0
    });
  });
});

describe('buildHealthUrl', () => {
  it('normalizes backend and signaling health URLs without query strings', () => {
    expect(buildHealthUrl('https://api.example/base/?token=redacted', '/health/ready')).toBe('https://api.example/base/health/ready');
    expect(buildHealthUrl('https://signal.example', '/health')).toBe('https://signal.example/health');
  });

  it('returns null for missing or invalid bases', () => {
    expect(buildHealthUrl(undefined, '/health')).toBeNull();
    expect(buildHealthUrl('not a url', '/health')).toBeNull();
  });
});

describe('displayEndpoint', () => {
  it('keeps host and path while dropping query strings and hashes', () => {
    expect(displayEndpoint('https://api.example/base?secret=nope#frag')).toBe('https://api.example/base');
  });

  it('does not echo malformed values', () => {
    expect(displayEndpoint('not a url')).toBe('invalid URL');
    expect(displayEndpoint(undefined)).toBe('not configured');
  });
});

describe('pickIpfsProbeRef', () => {
  it('prefers metadata refs for the gateway probe', () => {
    expect(pickIpfsProbeRef([track])).toBe('ipfs://QmManifest');
  });

  it('returns null when no IPFS-backed catalog ref exists', () => {
    expect(pickIpfsProbeRef([{ ...track, metadataRef: '', imageRef: 'data:image/svg+xml,test', audioRef: 'blob:test' }])).toBeNull();
  });
});
