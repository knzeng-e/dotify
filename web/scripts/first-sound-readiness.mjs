import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SURFACES = ['standalone-chrome', 'standalone-firefox', 'standalone-safari', 'ios-safari', 'android-chrome', 'product-desktop', 'product-web-gateway'];
const FLOWS = ['free', 'authorized-protected', 'warm-next-track'];
const CACHE_STATES = ['cold', 'warm'];
const CONNECTIONS = ['wifi', 'mobile', 'ethernet', 'other'];
const BUDGETS_MS = { free: 1_500, 'authorized-protected': 2_000, 'warm-next-track': 700 };
const BUDGET_CELLS = [
  { flow: 'free', cacheState: 'cold' },
  { flow: 'free', cacheState: 'warm' },
  { flow: 'authorized-protected', cacheState: 'cold' },
  { flow: 'authorized-protected', cacheState: 'warm' },
  { flow: 'warm-next-track', cacheState: 'warm' }
];
const MIN_BUDGET_SAMPLES = 4;
const MIN_FALLBACK_SAMPLES = 100;
const FULL_SHA = /^[0-9a-f]{40}$/i;
const PRODUCT_VERSION = /^\[\d+,\s*\d+,\s*\d+\]$/;
const CID = /^(?:bafy[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function exactKeys(value, expected) {
  return isRecord(value) && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
}

function percentile(values, quantile) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * quantile) - 1] ?? null;
}

function gate(id, label, status, detail) {
  return { id, label, status, detail };
}

function validateCandidate(candidate) {
  if (!exactKeys(candidate, ['gitSha', 'productAppVersion', 'deployedCid'])) return 'candidate must contain only gitSha, productAppVersion, and deployedCid';
  if (!FULL_SHA.test(candidate.gitSha ?? '')) return 'candidate.gitSha must be a full 40-character SHA';
  if (candidate.productAppVersion !== null && !PRODUCT_VERSION.test(candidate.productAppVersion ?? ''))
    return 'candidate.productAppVersion must be null or [major, minor, patch]';
  if (candidate.deployedCid !== null && !CID.test(candidate.deployedCid ?? '')) return 'candidate.deployedCid must be null or a canonical IPFS CID';
  return null;
}

function validProfileText(value) {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 80 &&
    value === value.trim() &&
    !Array.from(value).some(character => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  );
}

function validateProfile(profile) {
  if (!exactKeys(profile, ['surface', 'device', 'os', 'browser', 'productHostVersion', 'connection']))
    return 'profile must contain only surface, device, os, browser, productHostVersion, and connection';
  if (!SURFACES.includes(profile.surface)) return `profile.surface ${profile.surface} is unsupported`;
  for (const field of ['device', 'os', 'browser']) {
    if (!validProfileText(profile[field])) return `profile.${field} must be a single sanitized line of at most 80 characters`;
  }
  if (!CONNECTIONS.includes(profile.connection)) return `profile.connection ${profile.connection} is unsupported`;
  if (profile.surface.startsWith('product-')) {
    if (!validProfileText(profile.productHostVersion)) return 'Product profiles require productHostVersion';
  } else if (profile.productHostVersion !== null) {
    return 'Standalone profiles must use productHostVersion=null';
  }
  return null;
}

function validateSample(sample) {
  if (!exactKeys(sample, ['id', 'surface', 'flow', 'cacheState', 'outcome', 'firstSoundMs', 'capturedAt', 'dav2']))
    return 'sample contains unknown or missing fields';
  if (typeof sample.id !== 'string' || sample.id.length < 3 || sample.id.length > 160) return 'sample.id is invalid';
  if (!SURFACES.includes(sample.surface)) return `sample.surface ${sample.surface} is unsupported`;
  if (!FLOWS.includes(sample.flow)) return `sample.flow ${sample.flow} is unsupported`;
  if (!CACHE_STATES.includes(sample.cacheState)) return `sample.cacheState ${sample.cacheState} is unsupported`;
  if (sample.flow === 'warm-next-track' && sample.cacheState !== 'warm') return 'warm-next-track samples must use cacheState=warm';
  if (!['first-audio', 'error'].includes(sample.outcome)) return 'sample.outcome is invalid';
  if (sample.outcome === 'first-audio' && (!Number.isFinite(sample.firstSoundMs) || sample.firstSoundMs < 0))
    return 'successful sample requires a non-negative firstSoundMs';
  if (sample.outcome === 'error' && sample.firstSoundMs !== null) return 'failed sample must use null firstSoundMs';
  if (typeof sample.capturedAt !== 'string' || !Number.isFinite(Date.parse(sample.capturedAt))) return 'sample.capturedAt is invalid';
  if (!exactKeys(sample.dav2, ['observed', 'fallback', 'hedged', 'intentPrefetched', 'decryptor', 'firstRangeBytes']))
    return 'sample.dav2 contains unknown or missing fields';
  for (const field of ['observed', 'fallback', 'hedged', 'intentPrefetched']) {
    if (typeof sample.dav2[field] !== 'boolean') return `sample.dav2.${field} must be boolean`;
  }
  if (![null, 'worker', 'main-thread'].includes(sample.dav2.decryptor)) return 'sample.dav2.decryptor is invalid';
  if (sample.dav2.firstRangeBytes !== null && (!Number.isSafeInteger(sample.dav2.firstRangeBytes) || sample.dav2.firstRangeBytes <= 0)) {
    return 'sample.dav2.firstRangeBytes is invalid';
  }
  return null;
}

export function validateFirstSoundEvidence(evidence) {
  const problems = [];
  if (!exactKeys(evidence, ['schemaVersion', 'candidate', 'profile', 'capturedAt', 'samples', 'privacy'])) {
    problems.push('evidence contains unknown or missing top-level fields');
    return problems;
  }
  if (evidence.schemaVersion !== 2) problems.push('schemaVersion must be 2');
  const candidateProblem = validateCandidate(evidence.candidate);
  if (candidateProblem) problems.push(candidateProblem);
  const profileProblem = validateProfile(evidence.profile);
  if (profileProblem) problems.push(profileProblem);
  if (typeof evidence.capturedAt !== 'string' || !Number.isFinite(Date.parse(evidence.capturedAt))) problems.push('capturedAt is invalid');
  if (!Array.isArray(evidence.samples)) problems.push('samples must be an array');
  else {
    for (const [index, sample] of evidence.samples.entries()) {
      const sampleProblem = validateSample(sample);
      if (sampleProblem) problems.push(`samples[${index}]: ${sampleProblem}`);
      else if (sample.surface !== evidence.profile?.surface) problems.push(`samples[${index}]: sample.surface must match profile.surface`);
    }
  }
  if (
    !exactKeys(evidence.privacy, ['walletAddressesCollected', 'mediaReferencesCollected', 'gatewayUrlsCollected', 'perListenerHistoryCollected']) ||
    Object.values(evidence.privacy ?? {}).some(value => value !== false)
  ) {
    problems.push('privacy flags must explicitly confirm that no identifying or media-reference data was collected');
  }
  return problems;
}

function sameBuild(left, right) {
  return left.gitSha === right.gitSha;
}

function buildBudgetRow(samples, flow, cacheState, surface = null) {
  const successful = samples
    .filter(
      sample => (surface === null || sample.surface === surface) && sample.flow === flow && sample.cacheState === cacheState && sample.outcome === 'first-audio'
    )
    .map(sample => sample.firstSoundMs);
  const p75Ms = percentile(successful, 0.75);
  const targetMs = BUDGETS_MS[flow];
  return {
    ...(surface === null ? {} : { surface }),
    flow,
    cacheState,
    samples: successful.length,
    p75Ms,
    targetMs,
    status: successful.length < MIN_BUDGET_SAMPLES ? 'not-run' : p75Ms < targetMs ? 'pass' : 'fail'
  };
}

function budgetDetail(row) {
  return row.samples < MIN_BUDGET_SAMPLES
    ? `${row.samples}/${MIN_BUDGET_SAMPLES} successful samples; insufficient for the bounded p75 gate.`
    : `${Math.round(row.p75Ms)} ms observed; target < ${row.targetMs} ms.`;
}

export function buildFirstSoundReadinessReport(evidenceFiles, options = {}) {
  const gates = [];
  const evidence = [];
  for (const item of evidenceFiles) {
    const problems = validateFirstSoundEvidence(item.data);
    gates.push(
      gate(
        `schema:${item.path}`,
        `Evidence schema · ${item.path}`,
        problems.length === 0 ? 'pass' : 'fail',
        problems.length === 0 ? 'Sanitized schema v2 accepted.' : problems.join('; ')
      )
    );
    if (problems.length === 0) evidence.push(item.data);
  }

  const candidate = evidence[0]?.candidate ?? null;
  const profiles = evidence.map(item => ({ ...item.profile }));
  for (const [index, profile] of profiles.entries()) {
    gates.push(
      gate(
        `profile:${index}`,
        `Test profile · ${profile.surface}`,
        'pass',
        `${profile.device} · ${profile.os} · ${profile.browser} · ${profile.connection}${profile.productHostVersion ? ` · ${profile.productHostVersion}` : ''}`
      )
    );
  }
  const candidateMismatch = candidate ? evidence.some(item => !sameBuild(item.candidate, candidate)) : false;
  if (!candidate) gates.push(gate('candidate', 'Exact candidate', 'not-run', 'No valid evidence file supplied.'));
  else if (candidateMismatch) gates.push(gate('candidate', 'Exact candidate', 'fail', 'Evidence files refer to different git commits.'));
  else if (options.expectedCommit && candidate.gitSha !== options.expectedCommit) {
    gates.push(gate('candidate', 'Exact candidate', 'fail', `Evidence SHA ${candidate.gitSha} does not match expected ${options.expectedCommit}.`));
  } else
    gates.push(
      gate('candidate', 'Exact candidate', 'pass', `${candidate.gitSha} across ${evidence.length} evidence export${evidence.length === 1 ? '' : 's'}.`)
    );

  const samples = candidateMismatch ? [] : evidence.flatMap(item => item.samples);
  const sampleIds = new Set();
  const duplicateIds = [];
  for (const sample of samples) {
    if (sampleIds.has(sample.id)) duplicateIds.push(sample.id);
    sampleIds.add(sample.id);
  }
  gates.push(
    gate(
      'sample-identity',
      'Unique samples',
      samples.length === 0 ? 'not-run' : duplicateIds.length > 0 ? 'fail' : 'pass',
      samples.length === 0
        ? 'No timing samples supplied.'
        : duplicateIds.length > 0
          ? `${duplicateIds.length} duplicate sample IDs.`
          : `${samples.length} unique samples.`
    )
  );

  const productEvidence = evidence.filter(item => item.samples.some(sample => sample.surface.startsWith('product-')));
  const productSamples = samples.filter(sample => sample.surface.startsWith('product-'));
  const productIdentities = new Set(
    productEvidence
      .filter(item => item.candidate.productAppVersion && item.candidate.deployedCid)
      .map(item => `${item.candidate.productAppVersion}:${item.candidate.deployedCid}`)
  );
  const productIdentityComplete = productEvidence.every(item => item.candidate.productAppVersion && item.candidate.deployedCid);
  const productIdentity = productEvidence.find(item => item.candidate.productAppVersion && item.candidate.deployedCid)?.candidate ?? null;
  gates.push(
    gate(
      'product-identity',
      'Product deployment identity',
      productSamples.length === 0 ? 'not-run' : productIdentityComplete && productIdentities.size === 1 ? 'pass' : 'fail',
      productSamples.length === 0
        ? 'No Product-host sample supplied.'
        : productIdentityComplete && productIdentities.size === 1
          ? `${productSamples.length} Product samples are bound to ${productIdentity.productAppVersion} and ${productIdentity.deployedCid}.`
          : productIdentityComplete
            ? 'Product samples refer to different app versions or deployment CIDs.'
            : 'Every export containing Product samples requires both productAppVersion and deployedCid.'
    )
  );

  const matrix = SURFACES.map(surface => {
    const surfaceSamples = samples.filter(sample => sample.surface === surface);
    const successful = surfaceSamples.filter(sample => sample.outcome === 'first-audio').length;
    return {
      surface,
      samples: surfaceSamples.length,
      successful,
      status: surfaceSamples.length === 0 ? 'not-run' : successful === surfaceSamples.length ? 'pass' : 'fail'
    };
  });
  for (const row of matrix) {
    gates.push(
      gate(
        `surface:${row.surface}`,
        `Surface · ${row.surface}`,
        row.status,
        row.samples === 0 ? 'No evidence.' : `${row.successful}/${row.samples} attempts reached first sound.`
      )
    );
  }

  const budgets = BUDGET_CELLS.map(({ flow, cacheState }) => buildBudgetRow(samples, flow, cacheState));
  for (const row of budgets) {
    gates.push(gate(`budget:${row.flow}:${row.cacheState}`, `Aggregate p75 · ${row.flow} · ${row.cacheState}`, row.status, budgetDetail(row)));
  }

  // Aggregate p75 remains useful as a rollout overview, but it cannot prove a
  // required surface: a large fast Chrome sample could otherwise hide a slow
  // iPhone, Safari, Android, or Product host. Strict readiness therefore owns
  // an independent sample floor and budget for every surface/cell pair.
  const surfaceBudgets = SURFACES.flatMap(surface => BUDGET_CELLS.map(({ flow, cacheState }) => buildBudgetRow(samples, flow, cacheState, surface)));
  for (const row of surfaceBudgets) {
    gates.push(
      gate(
        `surface-budget:${row.surface}:${row.flow}:${row.cacheState}`,
        `Surface p75 · ${row.surface} · ${row.flow} · ${row.cacheState}`,
        row.status,
        budgetDetail(row)
      )
    );
  }

  const dav2Samples = samples.filter(sample => sample.dav2.observed);
  const fallbackCount = dav2Samples.filter(sample => sample.dav2.fallback).length;
  const fallbackRate = dav2Samples.length === 0 ? null : fallbackCount / dav2Samples.length;
  gates.push(
    gate(
      'fallback-rate',
      'DAV2 fallback rate',
      dav2Samples.length < MIN_FALLBACK_SAMPLES ? 'not-run' : fallbackRate < 0.01 ? 'pass' : 'fail',
      dav2Samples.length < MIN_FALLBACK_SAMPLES
        ? `${dav2Samples.length}/${MIN_FALLBACK_SAMPLES} DAV2 attempts; observed ${fallbackCount} fallback${fallbackCount === 1 ? '' : 's'}, but the <1% claim is not established.`
        : `${(fallbackRate * 100).toFixed(2)}% observed across ${dav2Samples.length} DAV2 attempts; target <1%.`
    )
  );

  const counts = {
    pass: gates.filter(item => item.status === 'pass').length,
    fail: gates.filter(item => item.status === 'fail').length,
    notRun: gates.filter(item => item.status === 'not-run').length
  };
  return {
    schemaVersion: 2,
    candidate,
    profiles,
    counts,
    gates,
    matrix,
    budgets,
    surfaceBudgets,
    fallback: { samples: dav2Samples.length, count: fallbackCount, rate: fallbackRate }
  };
}

export function renderFirstSoundReadinessMarkdown(report) {
  const profileRows = report.profiles.length
    ? report.profiles.map(
        profile =>
          `| ${profile.surface} | ${profile.device.replaceAll('|', '\\|')} | ${profile.os.replaceAll('|', '\\|')} | ${profile.browser.replaceAll('|', '\\|')} | ${profile.connection} | ${(profile.productHostVersion ?? '—').replaceAll('|', '\\|')} |`
      )
    : ['| — | — | — | — | — | — |'];
  const lines = [
    '# Dotify first-sound readiness',
    '',
    report.candidate ? `Candidate: \`${report.candidate.gitSha}\`` : 'Candidate: not supplied',
    '',
    `Summary: ${report.counts.pass} pass, ${report.counts.fail} fail, ${report.counts.notRun} not run.`,
    '',
    '| Surface | Device | OS | Browser | Connection | Product host |',
    '| --- | --- | --- | --- | --- | --- |',
    ...profileRows,
    '',
    '| Gate | Status | Evidence |',
    '| --- | --- | --- |',
    ...report.gates.map(item => `| ${item.label} | ${item.status} | ${item.detail.replaceAll('|', '\\|')} |`),
    ''
  ];
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = { evidencePaths: [], strict: false, expectedCommit: null, jsonOut: null, mdOut: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--evidence-json') options.evidencePaths.push(argv[++index]);
    else if (arg === '--expected-commit') options.expectedCommit = argv[++index];
    else if (arg === '--json-out') options.jsonOut = argv[++index];
    else if (arg === '--md-out') options.mdOut = argv[++index];
    else if (arg === '--strict') options.strict = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.evidencePaths.some(value => !value)) throw new Error('--evidence-json requires a file path');
  return options;
}

function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const evidenceFiles = options.evidencePaths.map(path => ({ path, data: JSON.parse(readFileSync(path, 'utf8')) }));
  const report = buildFirstSoundReadinessReport(evidenceFiles, { expectedCommit: options.expectedCommit ?? currentCommit() });
  const markdown = renderFirstSoundReadinessMarkdown(report);
  if (options.jsonOut) writeFileSync(options.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (options.mdOut) writeFileSync(options.mdOut, markdown);
  process.stdout.write(markdown);
  if (options.strict && (report.counts.fail > 0 || report.counts.notRun > 0)) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
