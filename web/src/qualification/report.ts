import { sanitizeHostSoftwareObservation, type HostSoftwareObservation } from '../features/productHost/productHostInfo';

export type QualificationBuild = {
  source: string;
  clean: boolean;
  configDigest: string;
  productId: string;
  appVersion: string;
  sdk: { product: string; host: string; truapi: string };
};

/** A supported wire observation grants no account, signing or access authority. */
export function hasSupportedQualificationRuntime(observation: HostSoftwareObservation | undefined): boolean {
  const host = sanitizeHostSoftwareObservation(observation);
  return host?.status === 'reported' && /^0\.31\.\d+$/.test(host.runtimeVersion ?? '');
}

export function qualificationReport(build: QualificationBuild, observation: unknown, requestedAt: string) {
  return {
    schema: 'dotify.host-qualification.v1',
    purpose: 'host-info-only',
    build: {
      source: /^[a-f0-9]{40}$/.test(build.source) ? build.source : 'unknown',
      clean: build.clean === true,
      configDigest: /^[a-f0-9]{64}$/.test(build.configDigest) ? build.configDigest : 'unknown',
      productId: build.productId === 'dotify-test01.dot' ? build.productId : 'unknown',
      appVersion: /^\d+\.\d+\.\d+$/.test(build.appVersion) ? build.appVersion : 'unknown',
      sdk: { product: build.sdk.product, host: build.sdk.host, truapi: build.sdk.truapi }
    },
    requestedAt,
    hostSoftware: sanitizeHostSoftwareObservation(observation) ?? { status: 'unavailable' },
    boundary: { accountRequested: false, signingRequested: false, chainQueried: false, applicationApiContacted: false }
  };
}
