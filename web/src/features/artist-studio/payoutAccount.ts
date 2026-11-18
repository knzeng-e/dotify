import { hexToBytes, parseAbi, type Address, type PublicClient } from 'viem';
// External runtime interface, not a Dotify facet. See the official System precompile reference.
const systemAbi = parseAbi(['function toAccountId(address input) view returns (bytes account_id)']);
export async function resolvePayoutAccount(client: Pick<PublicClient, 'getChainId' | 'readContract'>, recipient: Address): Promise<string> {
  if ((await client.getChainId()) !== 420420417) throw new Error('The payout account belongs to a different network.');
  const accountId = await client.readContract({
    address: '0x0000000000000000000000000000000000000900',
    abi: systemAbi,
    functionName: 'toAccountId',
    args: [recipient],
    blockTag: 'finalized'
  });
  if (!/^0x[\da-f]{64}$/i.test(accountId)) throw new Error('The payout account could not be verified.');
  const { ss58Encode, ss58ToH160 } = await import('@parity/product-sdk/address');
  const address = ss58Encode(hexToBytes(accountId));
  if (ss58ToH160(address).toLowerCase() !== recipient.toLowerCase()) throw new Error('The payout account does not match the beneficiary.');
  return address;
}
