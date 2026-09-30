import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { CID } from 'multiformats/cid';

const phases = ['baseline', 'background', 'network-change', 'reconnect', 'expiry'];
const kinds = ['presence', 'reaction', 'chat', 'request'];
const stages = ['attempt', 'submitted', 'rejected', 'accepted', 'duplicate', 'reordered', 'expired'];
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function keys(value, expected) {
  requireValue(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === expected.length &&
      expected.every(key => Object.hasOwn(value, key)),
    'Unexpected capture schema'
  );
}

export function validateCapture(value) {
  keys(value, ['version', 'metadata', 'buildSha', 'sdk', 'startedAt', 'endedAt', 'clocks', 'frames', 'markers', 'dropped', 'pending']);
  const m = value.metadata;
  keys(m, ['run', 'client', 'cid', 'device', 'hostVersion', 'network']);
  requireValue(typeof m.run === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(m.run) && ['A', 'B'].includes(m.client), 'Invalid run/client');
  for (const name of ['cid', 'device', 'hostVersion', 'network'])
    requireValue(typeof m[name] === 'string' && m[name].trim().length > 0 && m[name].length <= 160, `Invalid ${name}`);
  CID.parse(m.cid);
  requireValue(value.version === 1 && value.sdk === '0.6.9' && hex(value.buildSha, 40), 'Missing candidate SHA or unsupported capture version');
  requireValue(integer(value.startedAt) && integer(value.endedAt) && value.endedAt >= value.startedAt, 'Stop the capture before reporting');
  requireValue(integer(value.dropped) && value.pending === 0, 'Unfinished capture');
  requireValue(Array.isArray(value.clocks) && value.clocks.length > 0 && value.clocks.length <= 16, 'Invalid clock samples');
  for (const clock of value.clocks) {
    keys(clock, ['at', 'server', 'offsetMs', 'uncertaintyMs']);
    requireValue(
      integer(clock.at) &&
        hex(clock.server, 32) &&
        Number.isFinite(clock.offsetMs) &&
        Math.abs(clock.offsetMs) <= Number.MAX_SAFE_INTEGER &&
        Number.isFinite(clock.uncertaintyMs) &&
        clock.uncertaintyMs >= 26 &&
        clock.uncertaintyMs <= 776,
      'Invalid clock sample'
    );
  }
  requireValue(Array.isArray(value.frames) && value.frames.length <= 2000, 'Oversized frame list');
  for (const frame of value.frames) {
    keys(frame, ['at', 'clock', 'phase', 'kind', 'stage', 'frame', 'stream', 'seq', 'bytes', 'ttlMs', 'outOfOrder']);
    requireValue(
      integer(frame.at) &&
        frame.at >= value.startedAt &&
        frame.at <= value.endedAt &&
        phases.includes(frame.phase) &&
        kinds.includes(frame.kind) &&
        stages.includes(frame.stage),
      'Invalid frame labels/time'
    );
    requireValue(
      hex(frame.frame, 64) &&
        hex(frame.stream, 64) &&
        integer(frame.seq) &&
        frame.seq > 0 &&
        integer(frame.bytes) &&
        frame.bytes > 0 &&
        frame.bytes <= 512 &&
        frame.ttlMs === (frame.kind === 'presence' ? 30_000 : 10_000) &&
        typeof frame.outOfOrder === 'boolean',
      'Invalid frame metadata'
    );
    if (frame.clock !== null) {
      requireValue(integer(frame.clock) && frame.clock < value.clocks.length, 'Invalid frame clock index');
      const age = frame.at - value.clocks[frame.clock].at;
      requireValue(age >= 0 && age <= 120_000, 'Stale frame clock');
    }
  }
  requireValue(Array.isArray(value.markers) && value.markers.length <= 100, 'Invalid environment markers');
  for (const marker of value.markers) {
    keys(marker, ['at', 'phase', 'visibility', 'online']);
    requireValue(
      integer(marker.at) &&
        marker.at >= value.startedAt &&
        marker.at <= value.endedAt &&
        phases.includes(marker.phase) &&
        ['visible', 'hidden', 'unknown', 'prerender'].includes(marker.visibility) &&
        (marker.online === null || typeof marker.online === 'boolean'),
      'Invalid environment marker'
    );
  }
  return value;
}

function timestamp(capture, frame) {
  if (frame.clock === null) return null;
  const clock = capture.clocks[frame.clock];
  return { time: frame.at + clock.offsetMs, uncertainty: clock.uncertaintyMs, server: clock.server };
}
function boundary(capture, at, server) {
  const candidates = capture.clocks.filter(clock => clock.server === server && Math.abs(at - clock.at) <= 120_000);
  candidates.sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at));
  const clock = candidates[0];
  return clock ? { time: at + clock.offsetMs, uncertainty: clock.uncertaintyMs } : null;
}
function distribution(samples) {
  if (!samples.length) return null;
  const sorted = samples.map(sample => sample.estimate).sort((a, b) => a - b);
  const percentile = p => sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)];
  return {
    samples: samples.length,
    estimatedP50Ms: percentile(0.5),
    estimatedP95Ms: percentile(0.95),
    estimatedMaxMs: sorted.at(-1),
    minLowerBoundMs: Math.min(...samples.map(sample => sample.estimate - sample.uncertainty)),
    maxUpperBoundMs: Math.max(...samples.map(sample => sample.estimate + sample.uncertainty)),
    maxUncertaintyMs: Math.max(...samples.map(sample => sample.uncertainty))
  };
}
function direction(sender, receiver, kind, phase) {
  const sent = sender.frames.filter(frame => frame.kind === kind && frame.phase === phase);
  const attempts = new Map(sent.filter(frame => frame.stage === 'attempt').map(frame => [frame.frame, frame]));
  const submitted = new Map(sender.frames.filter(frame => attempts.has(frame.frame) && frame.stage === 'submitted').map(frame => [frame.frame, frame]));
  const rejected = new Set(sender.frames.filter(frame => attempts.has(frame.frame) && frame.stage === 'rejected').map(frame => frame.frame));
  const received = receiver.frames.filter(frame => frame.kind === kind && attempts.has(frame.frame));
  for (const frame of received) {
    const attempt = attempts.get(frame.frame);
    requireValue(
      frame.stream === attempt.stream && frame.seq === attempt.seq && frame.bytes === attempt.bytes && frame.ttlMs === attempt.ttlMs,
      'Correlated frame metadata differs'
    );
  }
  const accepted = new Map();
  for (const frame of received.filter(frame => frame.stage === 'accepted').sort((a, b) => a.at - b.at))
    if (!accepted.has(frame.frame)) accepted.set(frame.frame, frame);
  let unobservedWithFullWindow = 0;
  let unobservedWithoutFullWindow = 0;
  let missingClock = 0;
  let inconsistentClock = 0;
  const latency = [];
  for (const [hash, attempt] of attempts) {
    const start = timestamp(sender, attempt);
    const delivery = accepted.get(hash);
    if (delivery) {
      const end = timestamp(receiver, delivery);
      if (!start || !end || start.server !== end.server) {
        missingClock++;
        continue;
      }
      const estimate = end.time - start.time;
      const uncertainty = start.uncertainty + end.uncertainty;
      if (estimate + uncertainty < 0) {
        inconsistentClock++;
        continue;
      }
      latency.push({ estimate, uncertainty });
    } else if (submitted.has(hash)) {
      const first = start && boundary(receiver, receiver.startedAt, start.server);
      const last = start && boundary(receiver, receiver.endedAt, start.server);
      if (
        first &&
        last &&
        first.time + first.uncertainty <= start.time - start.uncertainty &&
        last.time - last.uncertainty >= start.time + attempt.ttlMs + start.uncertainty
      )
        unobservedWithFullWindow++;
      else unobservedWithoutFullWindow++;
    }
  }
  return {
    direction: `${sender.metadata.client}->${receiver.metadata.client}`,
    kind,
    phase,
    attempts: attempts.size,
    submitted: submitted.size,
    rejected: rejected.size,
    unknownSubmission: [...attempts.keys()].filter(hash => !submitted.has(hash) && !rejected.has(hash)).length,
    accepted: accepted.size,
    acceptedDespiteUnknownSubmission: [...accepted.keys()].filter(hash => !submitted.has(hash) && !rejected.has(hash)).length,
    duplicateReceipts: received.filter(frame => frame.stage === 'duplicate').length,
    reorderedAccepted: received.filter(frame => frame.stage === 'accepted' && frame.outOfOrder).length,
    replayWindowRejected: received.filter(frame => frame.stage === 'reordered').length,
    expiredReceipts: received.filter(frame => frame.stage === 'expired').length,
    unobservedWithFullWindow,
    unobservedWithoutFullWindow,
    missingClock,
    inconsistentClock,
    observationTrust: kind === 'presence' ? 'untrusted-presence' : 'membership-authenticated-private',
    attemptToObservation: distribution(latency)
  };
}

export function reportCaptures(first, second) {
  const a = validateCapture(first);
  const b = validateCapture(second);
  requireValue(
    a.metadata.client !== b.metadata.client && a.metadata.run === b.metadata.run && a.metadata.cid === b.metadata.cid && a.buildSha === b.buildSha,
    'Captures must be distinct clients in the same run, CID and build'
  );
  const rows = [];
  for (const [sender, receiver] of [
    [a, b],
    [b, a]
  ])
    for (const kind of kinds)
      for (const phase of phases) {
        const row = direction(sender, receiver, kind, phase);
        if (row.attempts || row.submitted || row.rejected) rows.push(row);
      }
  return {
    version: 1,
    run: a.metadata.run,
    cid: a.metadata.cid,
    buildSha: a.buildSha,
    sdk: a.sdk,
    clients: [a, b].map(capture => ({
      ...capture.metadata,
      dropped: capture.dropped,
      frames: capture.frames.length,
      markers: capture.markers,
      orphanSubmissionRecords: capture.frames.filter(
        frame => ['submitted', 'rejected'].includes(frame.stage) && !capture.frames.some(other => other.frame === frame.frame && other.stage === 'attempt')
      ).length
    })),
    completeCapture: a.dropped === 0 && b.dropped === 0,
    measuredPhases: [...new Set(rows.filter(row => row.accepted > 0).map(row => row.phase))],
    rows,
    limitations: [
      'Operator-declared devices, CID, host version and network are not attestation.',
      'Submitted means Host accepted submission, not remote delivery. Unknown submission is never counted as rejection.',
      'Unobserved is not network loss: expiry, channel replacement, capture limits, suspension and other recipients can explain it. Use exactly two Product participants.',
      'Presence is untrusted, never authenticated host state. Private observations are membership-authenticated.',
      'Latency includes submission and private application decryption; clock estimates assume a stable common server and include round-trip uncertainty.',
      'Transport/Host deduplication before Dotify is not measurable here. No automatic acceptance or migration decision.'
    ]
  };
}

async function load(path) {
  requireValue((await stat(path)).size <= 2_000_000, 'Capture file exceeds 2 MB');
  return JSON.parse(await readFile(path, 'utf8'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    requireValue(process.argv.length === 4, 'Usage: node scripts/celerity-capture-report.mjs client-A.json client-B.json');
    console.log(JSON.stringify(reportCaptures(await load(process.argv[2]), await load(process.argv[3])), null, 2));
  } catch (error) {
    console.error(`Capture report unavailable: ${error.message}`);
    process.exitCode = 1;
  }
}
