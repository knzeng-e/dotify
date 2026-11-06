/** Build a standalone index from authenticated FFmpeg DASH fragments, without re-encoding audio. */
type Box = { type: string; start: number; end: number };
const fail = (): never => {
  throw new Error('Unsupported audio compatibility container');
};
function boxes(bytes: Uint8Array): Box[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const result: Box[] = [];
  for (let start = 0; start < bytes.length; ) {
    if (bytes.length - start < 8 || result.length >= 32) fail();
    const size = view.getUint32(start);
    if (size < 8 || size > bytes.length - start) fail();
    result.push({ type: String.fromCharCode(...bytes.subarray(start + 4, start + 8)), start, end: start + size });
    start += size;
  }
  return result;
}

export function compatibilityMp4(parts: readonly Uint8Array[]): Uint8Array[] {
  if (parts.length < 2 || parts.length > 257) fail();
  const fragments = parts.slice(1).map(bytes => {
    const top = boxes(bytes);
    // The encoder's DASH profile emits one local index and one moof/mdat pair.
    if (top.map(box => box.type).join(',') !== 'styp,sidx,moof,mdat') fail();
    const index = bytes.subarray(top[1].start, top[1].end);
    const view = new DataView(index.buffer, index.byteOffset, index.byteLength);
    // Version 1 uses 64-bit earliest time/offset; reference_type must be media.
    if (index.length !== 52 || view.getUint32(8) !== 0x01000000 || view.getUint16(36) !== 0 || view.getUint16(38) !== 1) fail();
    const payload = bytes.subarray(top[2].start);
    if (view.getBigUint64(28) !== 0n || view.getUint32(40) !== payload.length || view.getUint32(44) === 0) fail();
    // Moving fragments is valid only when data offsets are relative to moof.
    const moof = bytes.subarray(top[2].start + 8, top[2].end);
    const trafs = boxes(moof).filter(box => box.type === 'traf');
    if (trafs.length !== 1) fail();
    const traf = moof.subarray(trafs[0].start + 8, trafs[0].end);
    const headers = boxes(traf).filter(box => box.type === 'tfhd');
    if (headers.length !== 1 || headers[0].end - headers[0].start < 16) fail();
    const flags = new DataView(traf.buffer, traf.byteOffset, traf.byteLength).getUint32(headers[0].start + 8);
    if ((flags & 0xff020001) !== 0x020000) fail();
    return {
      payload,
      track: view.getUint32(12),
      timescale: view.getUint32(16),
      start: view.getBigUint64(20),
      duration: view.getUint32(44),
      sap: view.getUint32(48)
    };
  });
  const first = fragments[0];
  let nextTime = first.start;
  for (const fragment of fragments) {
    if (!first.timescale || fragment.track !== first.track || fragment.timescale !== first.timescale || fragment.start !== nextTime) fail();
    nextTime += BigInt(fragment.duration);
  }
  // One complete sidx replaces the per-segment indexes. Keeping only the first
  // local sidx makes Linux WebKit/GStreamer stop after that fragment. Payload
  // views preserve every moof/mdat byte; the resulting Blob is smaller than input.
  const index = new Uint8Array(40 + fragments.length * 12);
  const view = new DataView(index.buffer);
  view.setUint32(0, index.length);
  index.set([0x73, 0x69, 0x64, 0x78], 4); // sidx
  view.setUint32(8, 0x01000000);
  view.setUint32(12, first.track);
  view.setUint32(16, first.timescale);
  view.setBigUint64(20, first.start);
  view.setUint16(38, fragments.length);
  fragments.forEach((fragment, i) => {
    view.setUint32(40 + i * 12, fragment.payload.length);
    view.setUint32(44 + i * 12, fragment.duration);
    view.setUint32(48 + i * 12, fragment.sap);
  });
  return [parts[0], index, ...fragments.map(fragment => fragment.payload)];
}
