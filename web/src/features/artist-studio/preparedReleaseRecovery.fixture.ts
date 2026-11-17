// Public synthetic pilot metadata; no key or signer. Test-only fixture.
import type { PreparedRelease } from './preparedReleaseRecovery';
export const preparedReleaseFixture: PreparedRelease = {
  owner: '0x2f6bf01a6708c927b288a53b9fe3f9edc689ff56',
  runtimeAddress: '0x05c643a1ed0e75c8a3486410f13bc4597c2674d7',
  chainId: 420420417,
  manifest: {
    schema: 'dotify.track.v2',
    createdAt: '2026-11-02T22:02:45.093Z',
    assets: {
      audioCID: 'bafykbzacedt5ltqhhtsffynpcfusxpxd6dlifcfsoyl6cld53lacraduyo2lw',
      coverCID: 'bafykbzacedkn3434glr32ntnw2eaopqkwdiio7mhk2k4uqbgqkd5cgaoukxz6/cover/640.webp',
      encrypted: true,
      keyVersion: 'dotify-content-key-v2'
    },
    track: {
      contentHash: '0x66aae2bdd5859205f46c62291d93d6d5618e56201a507c2b9f5277823edafd35',
      title: 'Bulletin pilot - 8s',
      artistName: 'Thot Nzeng',
      description: 'A 8 seconds testing sound to measure Bulletin direct pubvlication',
      durationSeconds: 8,
      accessMode: 'classic',
      priceDot: '1.21',
      requiredPersonhood: 'None',
      zone: 'Studio'
    },
    editorial: {
      releaseKind: 'single',
      projectTitle: '',
      version: '',
      releaseDate: '',
      genres: [],
      languages: [],
      credits: [],
      label: '',
      productionLocation: '',
      explicitContent: false,
      isrc: '',
      copyrightNotice: '',
      masterNotice: ''
    },
    royalties: [
      {
        recipient: '0x2f6bf01a6708c927b288a53b9fe3f9edc689ff56',
        bps: 10000
      }
    ],
    settlement: {
      target: 'evm',
      royaltyBps: 10000,
      pricePlanck: '1210000000000000000'
    }
  }
};
