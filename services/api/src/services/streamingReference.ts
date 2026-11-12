// Portable registered wire grammar. Encryption/key versions and physical layout
// are independent. Platform callers supply their existing CID codec.
export type StreamingLayout = 'unixfs-files-v1' | 'rendition-pack-v1';
type Cid = { version: number; code: number; multihash: { code: number; digest: { length: number } }; toString(): string };
export type StreamingReference = { root: string; keyVersion: `dotify-content-key-v${number}`; layout: StreamingLayout };
const REF = /^dotify:enc:v3:key-v((?:[2-9]|[1-9][0-9]+)):(ipfs|bulletin-pack-v1):\/\/((?:Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,110}))$/;
export function parseStreamingReference(ref: string, parseCid: (value: string) => Cid): StreamingReference | null {
  const match = REF.exec(ref);
  if (!match) return null;
  const layout = match[2] === 'ipfs' ? 'unixfs-files-v1' : 'rendition-pack-v1';
  if (layout === 'rendition-pack-v1') {
    try {
      const cid = parseCid(match[3]);
      if (cid.version !== 1 || cid.code !== 0x70 || cid.multihash.code !== 0xb220 || cid.multihash.digest.length !== 32 || cid.toString() !== match[3])
        return null;
    } catch {
      return null;
    }
  }
  return { root: match[3], keyVersion: `dotify-content-key-v${match[1]}` as StreamingReference['keyVersion'], layout };
}
export function formatStreamingReference(root: string, keyVersion: string, layout: StreamingLayout, parseCid: (value: string) => Cid): string {
  if (layout !== 'unixfs-files-v1' && layout !== 'rendition-pack-v1') throw new Error('Unsupported streaming layout');
  const ref = `dotify:enc:v3:${keyVersion.replace('dotify-content-', '')}:${layout === 'rendition-pack-v1' ? 'bulletin-pack-v1' : 'ipfs'}://${root}`;
  const parsed = parseStreamingReference(ref, parseCid);
  if (!parsed || parsed.keyVersion !== keyVersion || parsed.root !== root || parsed.layout !== layout) throw new Error('Invalid streaming reference');
  return ref;
}
