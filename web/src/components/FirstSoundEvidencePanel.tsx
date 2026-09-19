import { Clipboard, Download, Play, RefreshCcw, Square } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useUiFeedback } from '../app/providers/UiFeedbackProvider';
import { clearAudioStartupTelemetry, getAudioStartupTelemetrySnapshot } from '../features/catalog/audioStartupTelemetry';
import {
  FIRST_SOUND_FLOWS,
  FIRST_SOUND_CACHE_STATES,
  FIRST_SOUND_CONNECTIONS,
  FIRST_SOUND_SURFACES,
  beginFirstSoundAttempt,
  bindFirstSoundCandidate,
  bindFirstSoundTestProfile,
  buildFirstSoundEvidence,
  cancelFirstSoundAttempt,
  clearFirstSoundEvidence,
  finishFirstSoundAttempt,
  percentile,
  productCandidateComplete,
  readFirstSoundEvidenceDraft,
  serializeFirstSoundEvidence,
  surfaceNeedsProductCandidate,
  type FirstSoundEvidenceContext,
  type FirstSoundCacheState,
  type FirstSoundConnection,
  type FirstSoundFlow,
  type FirstSoundSurface
} from '../features/catalog/firstSoundEvidence';
import { normalizeIpfsCid } from '../shared/utils/ipfsCid';

type FirstSoundEvidencePanelProps = {
  context: FirstSoundEvidenceContext;
};

const FLOW_LABELS: Record<FirstSoundFlow, string> = {
  free: 'Free track',
  'authorized-protected': 'Already-open protected track',
  'warm-next-track': 'Warm next-track transition'
};

const SURFACE_LABELS: Record<FirstSoundSurface, string> = {
  'standalone-chrome': 'Desktop Chrome',
  'standalone-firefox': 'Desktop Firefox',
  'standalone-safari': 'Desktop Safari',
  'ios-safari': 'iPhone / iPad Safari',
  'android-chrome': 'Android Chrome',
  'product-desktop': 'Product Desktop',
  'product-web-gateway': 'Product Web gateway'
};

const FLOW_BUDGET_MS: Record<FirstSoundFlow, number> = {
  free: 1_500,
  'authorized-protected': 2_000,
  'warm-next-track': 700
};

export function FirstSoundEvidencePanel({ context }: FirstSoundEvidencePanelProps) {
  const { pushNotice } = useUiFeedback();
  const [draft, setDraft] = useState(() => readFirstSoundEvidenceDraft());
  const [deployedCid, setDeployedCid] = useState(() => readFirstSoundEvidenceDraft()?.candidate.deployedCid ?? '');
  const [surface, setSurface] = useState<FirstSoundSurface>(() => readFirstSoundEvidenceDraft()?.profile?.surface ?? 'standalone-chrome');
  const [device, setDevice] = useState(() => readFirstSoundEvidenceDraft()?.profile?.device ?? '');
  const [os, setOs] = useState(() => readFirstSoundEvidenceDraft()?.profile?.os ?? '');
  const [browser, setBrowser] = useState(() => readFirstSoundEvidenceDraft()?.profile?.browser ?? '');
  const [productHostVersion, setProductHostVersion] = useState(() => readFirstSoundEvidenceDraft()?.profile?.productHostVersion ?? '');
  const [connection, setConnection] = useState<FirstSoundConnection>(() => readFirstSoundEvidenceDraft()?.profile?.connection ?? 'wifi');
  const [flow, setFlow] = useState<FirstSoundFlow>('free');
  const [cacheState, setCacheState] = useState<FirstSoundCacheState>('cold');
  const normalizedCid = normalizeIpfsCid(deployedCid) || null;
  const candidateActive = Boolean(
    draft &&
    context.buildClean &&
    draft.candidate.gitSha === context.buildSha?.trim().toLowerCase() &&
    draft.candidate.productAppVersion === (context.productAppVersion?.trim() || null) &&
    draft.candidate.deployedCid === normalizedCid
  );
  const profileActive = Boolean(
    candidateActive &&
    draft?.profile?.surface === surface &&
    draft.profile.device === device.trim().replace(/\s+/g, ' ') &&
    draft.profile.os === os.trim().replace(/\s+/g, ' ') &&
    draft.profile.browser === browser.trim().replace(/\s+/g, ' ') &&
    draft.profile.productHostVersion === (surfaceNeedsProductCandidate(surface) ? productHostVersion.trim().replace(/\s+/g, ' ') || null : null) &&
    draft.profile.connection === connection
  );
  const productReady = draft ? productCandidateComplete(draft.candidate) : false;
  const evidence = useMemo(() => (draft ? buildFirstSoundEvidence(draft) : null), [draft]);
  const serializedEvidence = useMemo(() => (evidence ? serializeFirstSoundEvidence(evidence) : ''), [evidence]);
  const flowSamples =
    draft?.samples.filter(
      sample => sample.flow === flow && sample.cacheState === cacheState && sample.outcome === 'first-audio' && sample.firstSoundMs !== null
    ) ?? [];
  const p75 = percentile(
    flowSamples.map(sample => sample.firstSoundMs as number),
    0.75
  );

  function bindCandidate() {
    const next = bindFirstSoundCandidate(context, deployedCid);
    if (!next) {
      pushNotice({
        tone: 'error',
        title: 'Candidate unavailable',
        message: context.buildClean
          ? 'This QA capture needs the exact 40-character build SHA. Add a deployment CID for Product-host samples.'
          : 'This build contains uncommitted changes. Commit them and rebuild before collecting candidate evidence.'
      });
      return;
    }
    setDraft(next);
    setDeployedCid(next.candidate.deployedCid ?? '');
    pushNotice({ tone: 'success', title: 'Candidate bound', message: 'Every new timing will belong to this exact build.' });
  }

  function bindProfile() {
    const previousSamples = draft?.samples.length ?? 0;
    const next = bindFirstSoundTestProfile({
      surface,
      device,
      os,
      browser,
      productHostVersion: productHostVersion || null,
      connection
    });
    if (!next) {
      pushNotice({
        tone: 'error',
        title: 'Test profile incomplete',
        message: surfaceNeedsProductCandidate(surface)
          ? 'Record the device, OS, browser, Product host version, and connection before measuring.'
          : 'Record the device, OS, browser, and connection before measuring.'
      });
      return;
    }
    setDraft(next);
    pushNotice({
      tone: 'success',
      title: 'Test profile bound',
      message:
        previousSamples > 0 && next.samples.length === 0
          ? 'The changed profile starts a separate evidence set.'
          : 'New samples will include this device profile.'
    });
  }

  function startAttempt() {
    clearAudioStartupTelemetry();
    const next = beginFirstSoundAttempt(surface, flow, cacheState);
    if (!next) {
      pushNotice({
        tone: 'error',
        title: 'Capture cannot start',
        message: surfaceNeedsProductCandidate(surface) ? 'Bind the Product app version and deployment CID first.' : 'Bind this build first.'
      });
      return;
    }
    setDraft(next);
    pushNotice({ tone: 'info', title: 'Timing started', message: 'Play the chosen track now, then capture after sound begins or an error appears.' });
  }

  function captureAttempt() {
    const next = finishFirstSoundAttempt(getAudioStartupTelemetrySnapshot());
    if (!next) {
      pushNotice({
        tone: 'info',
        title: 'No final result yet',
        message: 'Dotify has not observed both source selection and first sound or a playback error for this attempt.'
      });
      return;
    }
    setDraft(next);
    const sample = next.samples[next.samples.length - 1];
    pushNotice({
      tone: sample?.outcome === 'first-audio' ? 'success' : 'error',
      title: sample?.outcome === 'first-audio' ? 'First sound captured' : 'Playback failure captured',
      message:
        sample?.firstSoundMs === null || sample?.firstSoundMs === undefined
          ? 'The failed attempt is included without private error detail.'
          : `${sample.firstSoundMs} ms.`
    });
  }

  function cancelAttempt() {
    const next = cancelFirstSoundAttempt();
    if (next) setDraft(next);
  }

  async function copyEvidence() {
    if (!serializedEvidence) return;
    try {
      await navigator.clipboard.writeText(serializedEvidence);
      pushNotice({ tone: 'success', title: 'First-sound evidence copied', message: 'The sanitized candidate-bound JSON is on the clipboard.' });
    } catch {
      pushNotice({ tone: 'error', title: 'Copy failed', message: 'The host blocked clipboard access. Download the JSON instead.' });
    }
  }

  function downloadEvidence() {
    if (!serializedEvidence) return;
    const blob = new Blob([serializedEvidence], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `dotify-first-sound-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function resetEvidence() {
    clearFirstSoundEvidence();
    clearAudioStartupTelemetry();
    setDraft(null);
    setDeployedCid('');
    setDevice('');
    setOs('');
    setBrowser('');
    setProductHostVersion('');
    setConnection('wifi');
    pushNotice({ tone: 'info', title: 'First-sound evidence reset', message: 'Bind a candidate to begin a fresh measurement set.' });
  }

  return (
    <div className='product-smoke' aria-labelledby='first-sound-evidence-title'>
      <div className='product-smoke-head'>
        <div>
          <strong id='first-sound-evidence-title'>First-sound evidence</strong>
          <span>{draft ? `${draft.samples.length} sanitized sample${draft.samples.length === 1 ? '' : 's'}` : 'No candidate bound'}</span>
        </div>
        <span className='readiness-summary' data-tone={draft?.activeAttempt ? 'warning' : draft?.samples.length ? 'ok' : 'unknown'}>
          {draft?.activeAttempt ? 'Timing active' : draft?.samples.length ? 'Evidence captured' : 'Not measured'}
        </span>
      </div>

      <div className='product-smoke-context'>
        <code>{context.buildSha?.slice(0, 12) || 'build SHA unavailable'}</code>
        <span>{context.productAppVersion || 'Standalone build'}</span>
        <span>{context.buildClean ? 'Exact committed build' : 'Uncommitted build'}</span>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='first-sound-cid'>Product deployment CID (only required for Product surfaces)</label>
        <input
          id='first-sound-cid'
          type='text'
          value={deployedCid}
          onChange={event => setDeployedCid(event.currentTarget.value)}
          placeholder='bafy…'
          autoCapitalize='none'
          autoCorrect='off'
          spellCheck={false}
        />
        <small>Changing the build, app version, or CID starts a separate evidence set.</small>
        <button className='secondary-action compact-action' type='button' onClick={bindCandidate}>
          {candidateActive ? 'Candidate bound' : 'Use this candidate'}
        </button>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='first-sound-surface'>Tested surface</label>
        <select
          id='first-sound-surface'
          value={surface}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => setSurface(event.currentTarget.value as FirstSoundSurface)}
        >
          {FIRST_SOUND_SURFACES.map(value => (
            <option key={value} value={value}>
              {SURFACE_LABELS[value]}
            </option>
          ))}
        </select>
        <label htmlFor='first-sound-device'>Device model</label>
        <input
          id='first-sound-device'
          type='text'
          value={device}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => setDevice(event.currentTarget.value)}
          placeholder='iPhone 13 Pro'
          maxLength={80}
        />
        <label htmlFor='first-sound-os'>OS and version</label>
        <input
          id='first-sound-os'
          type='text'
          value={os}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => setOs(event.currentTarget.value)}
          placeholder='iOS 16.7'
          maxLength={80}
        />
        <label htmlFor='first-sound-browser'>Browser and version</label>
        <input
          id='first-sound-browser'
          type='text'
          value={browser}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => setBrowser(event.currentTarget.value)}
          placeholder='Safari 16.6'
          maxLength={80}
        />
        {surfaceNeedsProductCandidate(surface) && (
          <>
            <label htmlFor='first-sound-product-host-version'>Product host version</label>
            <input
              id='first-sound-product-host-version'
              type='text'
              value={productHostVersion}
              disabled={Boolean(draft?.activeAttempt)}
              onChange={event => setProductHostVersion(event.currentTarget.value)}
              placeholder='Product Desktop 0.1.0'
              maxLength={80}
            />
          </>
        )}
        <label htmlFor='first-sound-connection'>Connection profile</label>
        <select
          id='first-sound-connection'
          value={connection}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => setConnection(event.currentTarget.value as FirstSoundConnection)}
        >
          {FIRST_SOUND_CONNECTIONS.map(value => (
            <option key={value} value={value}>
              {value === 'wifi' ? 'Wi-Fi' : value === 'mobile' ? 'Mobile data' : value === 'ethernet' ? 'Ethernet' : 'Other network'}
            </option>
          ))}
        </select>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive || Boolean(draft?.activeAttempt)} onClick={bindProfile}>
          {profileActive ? 'Test profile bound' : 'Use this test profile'}
        </button>
        <small>Changing this profile starts a separate evidence set so different devices and networks cannot be blended silently.</small>
      </div>

      <div className='product-smoke-candidate'>
        <label htmlFor='first-sound-flow'>Listening flow</label>
        <select
          id='first-sound-flow'
          value={flow}
          disabled={Boolean(draft?.activeAttempt)}
          onChange={event => {
            const nextFlow = event.currentTarget.value as FirstSoundFlow;
            setFlow(nextFlow);
            if (nextFlow === 'warm-next-track') setCacheState('warm');
          }}
        >
          {FIRST_SOUND_FLOWS.map(value => (
            <option key={value} value={value}>
              {FLOW_LABELS[value]}
            </option>
          ))}
        </select>
        <label htmlFor='first-sound-cache-state'>Cache condition</label>
        <select
          id='first-sound-cache-state'
          value={cacheState}
          disabled={Boolean(draft?.activeAttempt) || flow === 'warm-next-track'}
          onChange={event => setCacheState(event.currentTarget.value as FirstSoundCacheState)}
        >
          {FIRST_SOUND_CACHE_STATES.map(value => (
            <option key={value} value={value}>
              {value === 'cold' ? 'Cold start' : 'Warm start'}
            </option>
          ))}
        </select>
        <small>
          {flowSamples.length === 0
            ? `No successful ${cacheState} ${FLOW_LABELS[flow].toLowerCase()} samples yet.`
            : `Observed ${cacheState} p75 ${Math.round(p75 ?? 0)} ms from ${flowSamples.length} sample${flowSamples.length === 1 ? '' : 's'}; ${
                flowSamples.length < 4 ? 'four samples are required before judging' : `target under ${FLOW_BUDGET_MS[flow]} ms`
              }.`}
        </small>
      </div>

      <div className='product-smoke-actions'>
        {!draft?.activeAttempt ? (
          <button
            className='secondary-action compact-action'
            type='button'
            disabled={!candidateActive || !profileActive || (surfaceNeedsProductCandidate(surface) && !productReady)}
            onClick={startAttempt}
          >
            <Play size={15} />
            Start sample
          </button>
        ) : (
          <>
            <button className='secondary-action compact-action' type='button' onClick={captureAttempt}>
              <Square size={15} />
              Capture result
            </button>
            <button className='secondary-action compact-action' type='button' onClick={cancelAttempt}>
              Cancel
            </button>
          </>
        )}
        <button
          className='secondary-action compact-action'
          type='button'
          disabled={!candidateActive || !draft?.samples.length}
          onClick={() => void copyEvidence()}
        >
          <Clipboard size={15} />
          Copy JSON
        </button>
        <button className='secondary-action compact-action' type='button' disabled={!candidateActive || !draft?.samples.length} onClick={downloadEvidence}>
          <Download size={15} />
          Download
        </button>
        <button className='secondary-action compact-action' type='button' onClick={resetEvidence}>
          <RefreshCcw size={15} />
          Reset
        </button>
      </div>
    </div>
  );
}
