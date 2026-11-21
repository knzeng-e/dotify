import { describe, expect, it } from 'vitest';
import { hasSupportedQualificationRuntime, qualificationReport, type QualificationBuild } from './report';

const build: QualificationBuild = {
  source: 'a'.repeat(40),
  clean: true,
  configDigest: 'b'.repeat(64),
  productId: 'dotify-test01.dot',
  appVersion: '0.1.89',
  sdk: { product: '0.45.0', host: '0.34.0', truapi: '0.31.0' }
};
const host = { status: 'reported' as const, platform: 'Ios' as const, name: 'Polkadot App', version: '0.10.0 (23)', runtimeVersion: '0.31.0' };

describe('read-only Host qualification report', () => {
  it('exports only the public allowlist and its exact source identity', () => {
    const report = qualificationReport(build, { ...host, account: 'PRIVATE', error: 'SECRET', token: 'TOKEN' }, '2026-11-21T12:00:00Z');
    expect(report.hostSoftware).toEqual(host);
    expect(report.build).toEqual(build);
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|SECRET|TOKEN/);
    expect(report.boundary).toEqual({ accountRequested: false, signingRequested: false, chainQueried: false, applicationApiContacted: false });
  });
  it('does not infer Runtime support from an application build number', () => {
    expect(hasSupportedQualificationRuntime(host)).toBe(true);
    expect(hasSupportedQualificationRuntime({ ...host, runtimeVersion: undefined })).toBe(false);
    expect(hasSupportedQualificationRuntime({ ...host, runtimeVersion: '0.26.0' })).toBe(false);
    expect(hasSupportedQualificationRuntime({ ...host, runtimeVersion: '0.31.0-rc.1' })).toBe(false);
    expect(hasSupportedQualificationRuntime({ status: 'timeout' })).toBe(false);
  });
  it('rejects malformed source identity and malformed Host metadata', () => {
    expect(qualificationReport({ ...build, source: 'unreviewed', configDigest: 'unsafe' }, { ...host, name: 'https://unsafe.test/' }, '').build.source).toBe(
      'unknown'
    );
    expect(qualificationReport(build, { ...host, name: 'https://unsafe.test/' }, '').hostSoftware).toEqual({ status: 'unavailable' });
  });
});
