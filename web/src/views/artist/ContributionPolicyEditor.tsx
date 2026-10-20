import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { isAddress, zeroHash, zeroAddress, type Address, type Hash } from 'viem';
import { useWalletContext } from '../../app/providers';
import { contributionReader, emptyPolicy, type ContributionPolicy } from '../../features/donations/contributions';
import { useContributionWriter } from '../../features/donations/useContributionWriter';
import type { CatalogTrack } from '../../shared/types';

function dateInput(seconds: bigint) {
  if (!seconds) return '';
  const date = new Date(Number(seconds) * 1000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function ContributionPolicyEditor({ runtime, tracks }: { runtime: Address; tracks: CatalogTrack[] }) {
  const wallet = useWalletContext();
  return <PolicyEditor key={`${runtime}:${wallet.listenerEvmAddress}:${wallet.ethRpcUrl}:${wallet.expectedChainId}`} runtime={runtime} tracks={tracks} />;
}
function PolicyEditor({ runtime, tracks }: { runtime: Address; tracks: CatalogTrack[] }) {
  const wallet = useWalletContext();
  const writer = useContributionWriter();
  const [scope, setScope] = useState<Hash>(zeroHash);
  const [policy, setPolicy] = useState<ContributionPolicy>(emptyPolicy);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [recipients, setRecipients] = useState<Array<{ address: string; percent: string }>>([]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  useEffect(() => {
    let canceled = false;
    setLoaded(false);
    setMessage('');
    contributionReader(wallet.ethRpcUrl)
      .policy(runtime, scope)
      .then(value => {
        if (canceled) return;
        setPolicy(value);
        setRecipients(value.recipients.map((address, i) => ({ address, percent: String(value.shares[i] / 100) })));
        setStart(dateInput(value.startsAt));
        setEnd(dateInput(value.endsAt));
        setLoaded(true);
      })
      .catch(() => {
        if (!canceled) setMessage('Contribution settings are unavailable. This runtime may need an artist-approved upgrade.');
      });
    return () => {
      canceled = true;
    };
  }, [runtime, scope, wallet.ethRpcUrl, wallet.listenerEvmAddress]);
  const assigned = recipients.reduce((total, row) => total + Number(row.percent || 0), 0);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      if ((await contributionReader(wallet.ethRpcUrl).client.getChainId()) !== wallet.expectedChainId)
        throw new Error('The settings network changed. Reconnect before saving.');
      if (new TextEncoder().encode(policy.description).length > 280) throw new Error('Keep the purpose within 280 UTF-8 bytes. Shorten it before saving.');
      const shares = recipients.map(row => Math.round(Number(row.percent) * 100));
      if (
        recipients.some(
          (row, i) => !isAddress(row.address) || row.address.toLowerCase() === zeroAddress || !/^\d+(\.\d{1,2})?$/.test(row.percent) || shares[i] <= 0
        ) ||
        shares.reduce((a, b) => a + b, 0) > 10000
      )
        throw new Error('Use valid receiving accounts and positive shares totaling at most 100%.');
      if (!/^0x[\da-f]{64}$/i.test(policy.campaign) || !isAddress(policy.roomAttestor))
        throw new Error('Check the campaign reference and room authority address.');
      const next = {
        ...policy,
        recipients: recipients.map(row => row.address as Address),
        shares,
        startsAt: start ? BigInt(Math.floor(new Date(start).getTime() / 1000)) : 0n,
        endsAt: end ? BigInt(Math.floor(new Date(end).getTime() / 1000)) : 0n
      };
      if (next.endsAt && next.endsAt <= next.startsAt) throw new Error('The end must follow the start.');
      if (!writer.contributionCall) throw new Error('This wallet cannot update contribution settings.');
      const hash = await writer.contributionCall(runtime, 'musicGiftSetPolicy', [scope, next]);
      await writer.waitForTransaction(hash);
      const updated = await contributionReader(wallet.ethRpcUrl).policy(runtime, scope);
      if (updated.version <= policy.version) throw new Error('Update submitted; waiting for the new settings. Refresh before submitting again.');
      setPolicy(updated);
      setMessage('Contribution settings saved. Existing receipts are unchanged.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The settings could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className='contribution-policy'>
      <div className='studio-section-head'>
        <div>
          <h2>Give your support a destination</h2>
          <p>Direct contributions to you, your collaborators or a cause you choose.</p>
        </div>
      </div>
      <label>
        Contributions
        <select className='field' disabled={busy} value={scope} onChange={event => setScope(event.target.value as Hash)}>
          <option value={zeroHash}>Gifts to your artist profile</option>
          {tracks.map(track => (
            <option key={track.id} value={track.hash}>
              Tips · {track.title}
            </option>
          ))}
        </select>
      </label>
      {loaded && (
        <form
          onSubmit={event => {
            event.preventDefault();
            void save();
          }}
        >
          <fieldset disabled={busy}>
            <label>
              Purpose
              <input
                className='field'
                maxLength={280}
                value={policy.description}
                onChange={event => setPolicy({ ...policy, description: event.target.value })}
                placeholder='For example: supporting the community music school'
              />
            </label>
            {scope !== zeroHash && (
              <label className='toggle-row'>
                <input type='checkbox' checked={policy.hostBps > 0} onChange={event => setPolicy({ ...policy, hostBps: event.target.checked ? 1000 : 0 })} />
                Share room tips with hosts
              </label>
            )}
            {scope !== zeroHash && policy.hostBps > 0 && (
              <label className='contribution-host-share'>
                Host share of the whole room tip (%)
                <input
                  className='field'
                  type='number'
                  min='0.01'
                  max='100'
                  step='0.01'
                  value={policy.hostBps / 100}
                  onChange={event => setPolicy({ ...policy, hostBps: Math.round(Number(event.target.value) * 100) })}
                />
                <small>The rest follows the work's rights split. Destinations below apply only to your resulting share.</small>
              </label>
            )}
            <div className='contribution-policy-dates'>
              <label>
                Starts (local time)
                <input className='field' type='datetime-local' value={start} onChange={event => setStart(event.target.value)} />
              </label>
              <label>
                Ends (optional)
                <input className='field' type='datetime-local' value={end} onChange={event => setEnd(event.target.value)} />
              </label>
            </div>
            <p>Outside this period, your portion returns to you and host sharing stops.</p>
            {recipients.map((row, i) => (
              <div className='contribution-recipient-editor' key={i}>
                <label>
                  Receiving account
                  <input
                    className='field'
                    required
                    value={row.address}
                    onChange={event => setRecipients(recipients.map((item, index) => (index === i ? { ...item, address: event.target.value } : item)))}
                  />
                </label>
                <label>
                  Share (%)
                  <input
                    className='field'
                    type='number'
                    min='0.01'
                    max='100'
                    step='0.01'
                    required
                    value={row.percent}
                    onChange={event => setRecipients(recipients.map((item, index) => (index === i ? { ...item, percent: event.target.value } : item)))}
                  />
                </label>
                <button
                  type='button'
                  className='icon-action'
                  title='Remove recipient'
                  aria-label={`Remove recipient ${i + 1}`}
                  onClick={() => setRecipients(recipients.filter((_, index) => index !== i))}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
            <button
              type='button'
              className='secondary-action'
              disabled={recipients.length >= 16}
              onClick={() => setRecipients([...recipients, { address: '', percent: '' }])}
            >
              <Plus size={16} />
              Add recipient
            </button>
            <p>{Math.max(0, 100 - assigned)}% of your remaining portion stays with you.</p>
            <details className='studio-technical'>
              <summary>Campaign and room verification</summary>
              <label>
                Campaign reference
                <input
                  className='field'
                  value={policy.campaign === zeroHash ? '' : policy.campaign}
                  placeholder='0x…'
                  onChange={event => setPolicy({ ...policy, campaign: (event.target.value || zeroHash) as Hash })}
                />
              </label>
              <p>A shared reference groups contributions; it does not certify the cause or its use of funds.</p>
              <label>
                Room authority address
                <input
                  className='field'
                  value={policy.roomAttestor === zeroAddress ? '' : policy.roomAttestor}
                  placeholder='0x…'
                  onChange={event => setPolicy({ ...policy, roomAttestor: (event.target.value || zeroAddress) as Address })}
                />
              </label>
              <p>This authority verifies the host and room for shared tips. A track can inherit the authority saved for your profile gifts.</p>
            </details>
            <button className='primary-action' disabled={busy || assigned > 100}>
              {busy ? 'Saving…' : 'Save contribution settings'}
            </button>
          </fieldset>
        </form>
      )}
      {message && <p role='status'>{message}</p>}
    </section>
  );
}
