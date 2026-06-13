import { BadgeCheck, LockKeyhole } from 'lucide-react';
import { PanelTitle } from '../../components/ui/PanelTitle';
import { EndpointRow } from '../../components/ui/EndpointRow';
import { shorten } from '../../utils/format';
import type { TrackInfo } from '../../types';

const blockscoutBaseUrl = 'https://blockscout-testnet.polkadot.io';

function getBlockscoutAddressUrl(address: `0x${string}`) {
  return `${blockscoutBaseUrl}/address/${address}`;
}

type AdvancedTabProps = {
  factoryAddress: `0x${string}` | undefined;
  directoryAddress: `0x${string}` | undefined;
  activeEvmAddress: `0x${string}`;
  artistRuntimeAddress: `0x${string}` | null;
  fileHash: `0x${string}` | '';
  audioCID: string;
  coverCID: string;
  bulletinManifestRef: string;
  trackInfo: TrackInfo | null;
  uploadToBulletinEnabled: boolean;
  activeSubstrateAddress: string | null;
};

export function AdvancedTab({
  factoryAddress,
  directoryAddress,
  activeEvmAddress,
  artistRuntimeAddress,
  fileHash,
  audioCID,
  coverCID,
  bulletinManifestRef,
  trackInfo,
  uploadToBulletinEnabled,
  activeSubstrateAddress
}: AdvancedTabProps) {
  return (
    <section className='content-grid artist-grid'>
      <div className='doc-panel contract-panel'>
        <PanelTitle icon={LockKeyhole} title='Technical details' meta={artistRuntimeAddress ? 'ready' : 'pending'} />
        <div className='stack-list'>
          <EndpointRow
            label='Factory'
            value={
              factoryAddress ? (
                <div className='endpoint-link-stack'>
                  <a className='verify-link' href={getBlockscoutAddressUrl(factoryAddress)} target='_blank' rel='noreferrer'>
                    {shorten(factoryAddress, 12)}
                  </a>
                  <small>Verify on Blockscout.</small>
                </div>
              ) : (
                'not deployed'
              )
            }
          />
          <EndpointRow
            label='Directory'
            value={
              directoryAddress ? (
                <a className='verify-link' href={getBlockscoutAddressUrl(directoryAddress)} target='_blank' rel='noreferrer'>
                  {shorten(directoryAddress, 12)}
                </a>
              ) : (
                'not deployed'
              )
            }
          />
          <EndpointRow
            label='Artist wallet'
            value={
              <a className='verify-link' href={getBlockscoutAddressUrl(activeEvmAddress)} target='_blank' rel='noreferrer'>
                {shorten(activeEvmAddress, 12)}
              </a>
            }
          />
          <EndpointRow
            label='Artist profile'
            value={
              artistRuntimeAddress ? (
                <a className='verify-link' href={getBlockscoutAddressUrl(artistRuntimeAddress)} target='_blank' rel='noreferrer'>
                  {shorten(artistRuntimeAddress, 12)}
                </a>
              ) : (
                'not registered'
              )
            }
          />
          <EndpointRow label='Content hash' value={fileHash ? shorten(fileHash, 18) : '0x'} />
          <EndpointRow label='Audio CID' value={audioCID ? shorten(audioCID, 18) : 'pending…'} />
          <EndpointRow label='Cover CID' value={coverCID ? shorten(coverCID, 18) : 'pending…'} />
          <EndpointRow label='Bulletin archive' value={bulletinManifestRef || trackInfo?.bulletinRef || 'not published'} />
        </div>
      </div>

      <div className='doc-panel'>
        <PanelTitle icon={BadgeCheck} title='Capabilities' meta='culture layer' />
        <div className='stack-list'>
          <EndpointRow label='Self-owned identity' value='Wallet address' />
          <EndpointRow label='Portable metadata' value='IPFS manifest' />
          <EndpointRow label='Public archive' value={uploadToBulletinEnabled ? 'enabled for next release' : 'optional by default'} />
          <EndpointRow label='Community signer' value={activeSubstrateAddress ? shorten(activeSubstrateAddress, 12) : 'not connected'} />
        </div>
      </div>
    </section>
  );
}
