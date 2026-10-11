import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { getAbiItem, isAddress, parseAbi, toFunctionSelector, zeroAddress } from 'viem';
import { Dialog } from './Dialog';
import { useCatalogContext, useUiFeedback, useWalletContext } from '../app/providers';
import { createRuntimeWriter } from '../features/runtime/runtimeWriterProvider';
import { resolveRuntimeAdapterConfig } from '../features/runtime/runtimeAdapterConfig';
import { resolveProductHostConfig } from '../features/productHost/productHost';
import { musicMetadataAbi } from '../generated/contracts/musicMetadata';
import { musicRegistryAbi } from '../generated/contracts/musicRegistry';
import { getPublicClient } from '../shared/config/contracts';
import { runtimeAddressFromTrackId } from '../features/catalog/trackModel';
import { fetchTrackManifest, uploadJsonToPinata, type DotifyTrackManifest } from '../services/pinata';
import { normalizeReleaseMetadata, parseMetadataList, RELEASE_KIND_OPTIONS, RELEASE_CREDIT_ROLE_OPTIONS } from '../features/catalog/releaseMetadata';
import type { CatalogTrack, ReleaseEditorialMetadata } from '../shared/types';

const selector = toFunctionSelector(getAbiItem({ abi: musicMetadataAbi, name: 'musicRegUpdateMetadata' }));
const loupe = parseAbi(['function facetAddress(bytes4) view returns (address)']);

export function ReleaseMetadataEditor({ track: initialTrack, onClose }: { track: CatalogTrack; onClose: () => void }) {
  // Keep the opening reference as the edit's expected version. A background
  // catalog refresh must not rebase a partially edited draft onto newer data.
  const [track] = useState(initialTrack);
  const wallet = useWalletContext();
  const catalog = useCatalogContext();
  const { setTransactionFeedback } = useUiFeedback();
  const [title, setTitle] = useState(track.title);
  const [story, setStory] = useState(track.description);
  const [manifest, setManifest] = useState<DotifyTrackManifest | null>(null);
  const [metadata, setMetadata] = useState<ReleaseEditorialMetadata | null>(null);
  const [status, setStatus] = useState('Checking release editing…');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = useRef({ account: wallet.connectedWallet?.evmAddress, track: track.id });
  useLayoutEffect(() => {
    current.current = { account: wallet.connectedWallet?.evmAddress, track: track.id };
  }, [wallet.connectedWallet, track.id]);
  const runtime = runtimeAddressFromTrackId(track);
  useEffect(() => {
    const abort = new AbortController();
    setReady(false);
    void (async () => {
      try {
        if (!runtime || !wallet.connectedWallet || track.artistAddress?.toLowerCase() !== wallet.connectedWallet.evmAddress.toLowerCase())
          throw new Error('Connect the original artist account to edit this release.');
        const client = getPublicClient(wallet.ethRpcUrl);
        const facet = await client.readContract({ address: runtime, abi: loupe, functionName: 'facetAddress', args: [selector] });
        if (!isAddress(facet) || facet.toLowerCase() === zeroAddress)
          throw new Error('This artist space needs the metadata editing upgrade before you can save corrections.');
        const original = await fetchTrackManifest(track.metadataRef, { signal: abort.signal });
        if (original.track.contentHash.toLowerCase() !== track.hash.toLowerCase())
          throw new Error('The release record does not match this track. Refresh before editing.');
        if (abort.signal.aborted) return;
        setManifest(original);
        setMetadata(original.editorial);
        setReady(true);
        setStatus('Audio, listening access and revenue splits stay attached to the same work.');
      } catch (error) {
        if (!abort.signal.aborted) setStatus(error instanceof Error ? error.message : 'Release editing is unavailable.');
      }
    })();
    return () => abort.abort();
  }, [track.id, track.hash, track.artistAddress, track.metadataRef, runtime, wallet.connectedWallet, wallet.ethRpcUrl]);

  async function save() {
    const account = wallet.connectedWallet?.evmAddress;
    if (!ready || busy || !manifest || !metadata || !runtime || !account || !wallet.expectedChainId) return;
    setBusy(true);
    let submitted = false;
    try {
      const client = getPublicClient(wallet.ethRpcUrl);
      const [record] = await client.readContract({ address: runtime, abi: musicRegistryAbi, functionName: 'musicRegGetTrack', args: [track.hash] });
      if (record.artist.toLowerCase() !== account.toLowerCase() || record.metadataRef !== track.metadataRef)
        throw new Error('The artist account or release record changed. Reopen the editor.');
      if (!title.trim() || title.trim().length > 200 || story.length > 2000)
        throw new Error('Use a title up to 200 characters and a story up to 2000 characters.');
      const next: DotifyTrackManifest = {
        ...manifest,
        createdAt: new Date().toISOString(),
        track: { ...manifest.track, title: title.trim(), description: story.trim() },
        editorial: normalizeReleaseMetadata(metadata)
      };
      setStatus('Saving the corrected release details…');
      const signer = wallet.connectedWallet?.keyRequestSigner;
      const identity = signer
        ? { signer, chainId: wallet.expectedChainId }
        : { walletClient: await wallet.getActiveWalletClient(), chainId: wallet.expectedChainId };
      const cid = await uploadJsonToPinata(next, `${next.track.title}.json`, { app: 'dotify', type: 'track-metadata' }, identity);
      if (current.current.account?.toLowerCase() !== account.toLowerCase() || current.current.track !== track.id)
        throw new Error('Your account changed. Reopen the editor before approving.');
      const config = resolveRuntimeAdapterConfig(import.meta.env);
      const product = resolveProductHostConfig(import.meta.env);
      const writer = createRuntimeWriter({
        ethRpcUrl: wallet.ethRpcUrl,
        getViemWalletClient: wallet.getActiveWalletClient,
        config,
        productAccount:
          wallet.connectedWallet?.method === 'product-host'
            ? { productId: product.productId, evmAddress: account, publicKey: signer && 'productPublicKey' in signer ? signer.productPublicKey : undefined }
            : undefined
      });
      if (!writer.updateMetadata) throw new Error('This account cannot edit release metadata.');
      setStatus('Approve these corrections in your account.');
      const hash = await writer.updateMetadata(runtime, track.hash, next.track.title, next.track.description, `ipfs://${cid}`, record.metadataRef);
      submitted = true;
      setStatus('Waiting for confirmation. Do not submit again.');
      await writer.waitForTransaction(hash);
      const [saved] = await client.readContract({ address: runtime, abi: musicRegistryAbi, functionName: 'musicRegGetTrack', args: [track.hash] });
      if (saved.metadataRef !== `ipfs://${cid}` || saved.title !== next.track.title || saved.description !== next.track.description)
        throw new Error('The approved correction is not visible from the read network yet. Refresh this release before trying again.');
      await catalog.refreshCatalogFromRegistry(track.hash, { fresh: true });
      onClose();
      setTransactionFeedback({
        tone: 'success',
        title: 'Release details updated',
        message: 'Your corrections are confirmed. The catalog will show them as its index catches up.',
        txHash: hash,
        proofKind: writer.contributionConfirmationMode === 'finalized-event' ? 'substrate-extrinsic' : 'evm-transaction'
      });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Corrections could not be saved.');
      if (submitted) setReady(false);
    } finally {
      setBusy(false);
    }
  }
  const patch = (value: Partial<ReleaseEditorialMetadata>) => setMetadata(previous => (previous ? { ...previous, ...value } : previous));
  return (
    <Dialog
      labelledBy='edit-release-title'
      onClose={() => {
        if (!busy) onClose();
      }}
      className='release-metadata-editor'
      size='wide'
    >
      <div className='modal-header'>
        <h2 id='edit-release-title'>Edit release details</h2>
        <button type='button' className='modal-close' aria-label='Close release editor' disabled={busy} onClick={onClose}>
          <X size={18} />
        </button>
      </div>
      <p role='status'>{status}</p>
      <form
        onSubmit={event => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={!ready || busy}>
          <label>
            Title
            <input className='field' value={title} maxLength={200} required onChange={event => setTitle(event.target.value)} />
          </label>
          <label>
            The story behind this track
            <textarea className='field' value={story} maxLength={2000} onChange={event => setStory(event.target.value)} />
          </label>
          {metadata && (
            <>
              <label>
                Release type
                <select
                  className='field'
                  value={metadata.releaseKind}
                  onChange={event => patch({ releaseKind: event.target.value as ReleaseEditorialMetadata['releaseKind'] })}
                >
                  {RELEASE_KIND_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              {(['projectTitle', 'version', 'releaseDate', 'label', 'productionLocation', 'isrc', 'copyrightNotice', 'masterNotice'] as const).map(key => (
                <label key={key}>
                  {
                    {
                      projectTitle: 'Album / project',
                      version: 'Version',
                      releaseDate: 'Original release date (YYYY or YYYY-MM-DD)',
                      label: 'Label',
                      productionLocation: 'Recorded / produced in',
                      isrc: 'ISRC',
                      copyrightNotice: 'Copyright notice',
                      masterNotice: 'Master recording notice'
                    }[key]
                  }
                  <input
                    className='field'
                    value={metadata[key]}
                    maxLength={key === 'releaseDate' ? 10 : key === 'isrc' ? 15 : key.endsWith('Notice') ? 300 : key === 'version' ? 120 : 200}
                    onChange={event => patch({ [key]: event.target.value })}
                  />
                </label>
              ))}
              <label>
                Genres (comma separated)
                <input
                  className='field'
                  value={metadata.genres.join(', ')}
                  onChange={event => patch({ genres: event.target.value.split(',') })}
                  onBlur={() => patch({ genres: parseMetadataList(metadata.genres.join(',')) })}
                />
              </label>
              <label>
                Languages (comma separated)
                <input
                  className='field'
                  value={metadata.languages.join(', ')}
                  onChange={event => patch({ languages: event.target.value.split(',') })}
                  onBlur={() => patch({ languages: parseMetadataList(metadata.languages.join(',')) })}
                />
              </label>
              <label className='release-explicit-toggle'>
                <input type='checkbox' checked={metadata.explicitContent} onChange={event => patch({ explicitContent: event.target.checked })} /> Explicit
                content
              </label>
              <div className='release-edit-credits'>
                <h3>Credits</h3>
                {metadata.credits.map((credit, index) => (
                  <div key={index}>
                    <input
                      className='field'
                      aria-label={`Credit ${index + 1} name`}
                      value={credit.name}
                      maxLength={200}
                      onChange={event => patch({ credits: metadata.credits.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })}
                    />
                    <select
                      className='field'
                      aria-label={`Credit ${index + 1} role`}
                      value={credit.role}
                      onChange={event =>
                        patch({ credits: metadata.credits.map((item, i) => (i === index ? { ...item, role: event.target.value as typeof item.role } : item)) })
                      }
                    >
                      {RELEASE_CREDIT_ROLE_OPTIONS.map(role => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type='button'
                      className='secondary-action compact-action'
                      aria-label={`Remove credit ${index + 1}`}
                      onClick={() => patch({ credits: metadata.credits.filter((_, i) => i !== index) })}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type='button'
                  className='secondary-action compact-action'
                  disabled={metadata.credits.length >= 20}
                  onClick={() => patch({ credits: [...metadata.credits, { name: '', role: 'performer' }] })}
                >
                  <Plus size={16} /> Add credit
                </button>
              </div>
            </>
          )}
        </fieldset>
        <button className='primary-action' type='submit' disabled={!ready || busy}>
          <Save size={16} />
          {busy ? 'Saving…' : 'Save corrections'}
        </button>
      </form>
    </Dialog>
  );
}
