// SPDX-License-Identifier: Apache-2.0
// Declaration excerpt from @parity/product-sdk-host 0.29.0.
// Official package integrity and full declaration SHA-256: cash-tip-source-identities-2026-11-13.json.
interface PaymentManager {
  subscribeBalance(callback: (balance: HostPaymentBalanceSubscribeItem) => void, purse?: number): HostSubscription;
  topUp(
    amount: bigint,
    source: PaymentTopUpSource,
    into?: number,
    id?: HexString
  ): Promise<{
    id: HexString;
  }>;
  requestPayment(
    amount: bigint,
    destination: HexString,
    from?: number,
    id?: HexString
  ): Promise<{
    id: HexString;
  }>;
  subscribePaymentStatus(id: HexString, callback: (status: HostPaymentStatusSubscribeItem) => void): HostSubscription;
}
