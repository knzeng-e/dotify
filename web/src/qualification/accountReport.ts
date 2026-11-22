import { qualificationReport, type QualificationBuild } from './report';
import { ACCOUNT_DERIVATION_INDEX, ACCOUNT_PRODUCT_ID, type AccountObservation } from './account';

export function accountQualificationReport(
  build: QualificationBuild,
  host: unknown,
  requestedAt: string,
  account: AccountObservation | undefined,
  ownerConfirmed: boolean,
  accountRequestedAt?: string
) {
  const base = qualificationReport(build, host, requestedAt);
  return {
    ...base,
    schema: 'dotify.account-qualification.v1',
    purpose: 'host-account-addresses-only',
    accountRequestedAt: accountRequestedAt ?? null,
    accountContext: { productId: ACCOUNT_PRODUCT_ID, derivationIndex: ACCOUNT_DERIVATION_INDEX, ss58Prefix: 42 },
    account:
      account?.status === 'reported'
        ? {
            status: 'reported',
            publicKey: account.publicKey,
            substrateAddress: account.substrateAddress,
            evmAddress: account.evmAddress,
            addressMapping: 'local-sdk-derivation-only',
            ownerConfirmed: ownerConfirmed === true
          }
        : { status: account?.status ?? 'not-requested' },
    boundary: {
      accountRequested: account?.accountRequested === true,
      signingRequested: false,
      chainQueried: false,
      applicationApiContacted: false,
      chainMappingVerified: false,
      signerControlVerified: false,
      artistRuntimeCreated: false
    }
  };
}
