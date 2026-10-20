// Synthetic documentation data only; never a published catalog.
import { createHash } from 'node:crypto';
import { CID } from 'multiformats/cid';
import { create as digest } from 'multiformats/hashes/digest';

export const artist = '0x000000000000000000000000000000000000a711';
export const runtime = '0x000000000000000000000000000000000000a712';
const titles = ['Riverlight', 'Night Crossing', 'Open Skies'];

function artwork(title, color, index) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><defs><linearGradient id="a" x2="1" y2="1"><stop stop-color="#0b2341"/><stop offset="1" stop-color="${color}"/></linearGradient></defs><rect width="640" height="640" fill="url(#a)"/><circle cx="${160 + index * 90}" cy="220" r="180" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/><circle cx="390" cy="390" r="220" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="2"/><path d="M0 460 Q160 240 320 460 T640 460" stroke="#fff" stroke-opacity=".5" stroke-width="3" fill="none"/><text x="48" y="540" fill="#fff" font-family="sans-serif" font-size="44">${title}</text><text x="50" y="580" fill="#fff" fill-opacity=".7" font-family="sans-serif" font-size="17" letter-spacing="5">MINA · DEMO RELEASE</text></svg>`;
  return svg;
}

export const covers = titles.map((title, index) => {
  const body = artwork(title, ['#176b67', '#693d70', '#285387'][index], index);
  const cid = CID.createV1(0x55, digest(0x12, createHash('sha256').update(body).digest())).toString();
  return { body, cid };
});

export const tracks = titles.map((title, index) => ({
  id: `${runtime}:0x${String(index + 1).padStart(64, '0')}`,
  hash: `0x${String(index + 1).padStart(64, '0')}`,
  artistAddress: artist,
  title,
  artist: 'Mina',
  active: true,
  source: 'artist',
  zone: 'Demo',
  audioRef: '/e2e/fixtures/continuity-tone.mp3',
  localUrl: '/e2e/fixtures/continuity-tone.mp3',
  imageRef: `ipfs://${covers[index].cid}`,
  priceDot: '0',
  description: 'A local demonstration release for the Dotify documentation.',
  bulletinRef: '',
  metadataRef: 'e2e:documentation',
  royaltyBps: 10000,
  durationLabel: 'Demo',
  accessMode: 'free',
  royaltySplits: [],
  personhoodLevel: 'DIM1',
  encrypted: false
}));
