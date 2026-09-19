import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SURFACES = ['standalone-chrome', 'standalone-firefox', 'standalone-safari', 'ios-safari', 'android-chrome', 'product-desktop', 'product-web-gateway'];
const FLOWS = ['free', 'authorized-protected', 'warm-next-track'];
const CACHE_STATES = ['cold', 'warm'];
const CONNECTIONS = ['wifi', 'mobile', 'ethernet', 'other'];
const DEVICE_CLASSES = ['desktop', 'laptop', 'phone', 'tablet', 'product-host', 'other'];
const OS_FAMILIES = ['windows', 'macos', 'linux', 'ios', 'android', 'product-host', 'other'];
const BROWSER_FAMILIES = ['chrome', 'firefox', 'safari', 'edge', 'product-webview', 'other'];
const HOST_TERMINAL_REASONS = ['access-denied', 'selection-failed', 'selection-interrupted', 'autoplay-blocked', 'media-error', 'muted-output'];
const SCENARIO_EXPECTATIONS = {
  'ordinary-playback': 'first-audio',
  'denied-protected': 'error',
  'broken-gateway': 'first-audio',
  'slow-key-service': 'first-audio',
  'interrupted-navigation': 'error',
  'corrupted-dav2': 'error'
};
const CONTROLLED_SCENARIOS = Object.keys(SCENARIO_EXPECTATIONS).filter(scenario => scenario !== 'ordinary-playback');
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
const CONFIG_DIGEST = /^[0-9a-f]{64}$/i;
const PRODUCT_VERSION = /^\[\d+,\s*\d+,\s*\d+\]$/;
const CID = /^(?:bafy[a-z2-7]{20,}|Qm[1-9A-HJ-NP-Za-km-z]{44})$/;
const PRODUCT_HOST_VERSION = /^\d{1,4}(?:\.\d{1,4}){1,3}$/;
const SLOW_KEY_PROOF_MS = 1_000;

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
  if (!exactKeys(candidate, ['gitSha', 'buildConfigDigest', 'productAppVersion', 'deployedCid']))
    return 'candidate must contain only gitSha, buildConfigDigest, productAppVersion, and deployedCid';
  if (!FULL_SHA.test(candidate.gitSha ?? '')) return 'candidate.gitSha must be a full 40-character SHA';
  if (!CONFIG_DIGEST.test(candidate.buildConfigDigest ?? '')) return 'candidate.buildConfigDigest must be a 64-character SHA-256 digest';
  if (candidate.productAppVersion !== null && !PRODUCT_VERSION.test(candidate.productAppVersion ?? ''))
    return 'candidate.productAppVersion must be null or [major, minor, patch]';
  if (candidate.deployedCid !== null && !CID.test(candidate.deployedCid ?? '')) return 'candidate.deployedCid must be null or a canonical IPFS CID';
  return null;
}

function validateProfile(profile) {
  if (!exactKeys(profile, ['surface', 'device', 'os', 'browser', 'productHostVersion', 'connection']))
    return 'profile must contain only surface, device, os, browser, productHostVersion, and connection';
  if (!SURFACES.includes(profile.surface)) return `profile.surface ${profile.surface} is unsupported`;
  if (!DEVICE_CLASSES.includes(profile.device)) return `profile.device ${profile.device} is unsupported`;
  if (!OS_FAMILIES.includes(profile.os)) return `profile.os ${profile.os} is unsupported`;
  if (!BROWSER_FAMILIES.includes(profile.browser)) return `profile.browser ${profile.browser} is unsupported`;
  if (!CONNECTIONS.includes(profile.connection)) return `profile.connection ${profile.connection} is unsupported`;
  if (profile.surface.startsWith('product-')) {
    if (!PRODUCT_HOST_VERSION.test(profile.productHostVersion ?? '')) return 'Product profiles require a numeric productHostVersion';
  } else if (profile.productHostVersion !== null) {
    return 'Standalone profiles must use productHostVersion=null';
  }
  return null;
}

function profileKey(profile) {
  return JSON.stringify({
    surface: profile.surface,
    device: profile.device,
    os: profile.os,
    browser: profile.browser,
    productHostVersion: profile.productHostVersion,
    connection: profile.connection
  });
}

function profileDetail(profile) {
  return `${profile.device} · ${profile.os} · ${profile.browser} · ${profile.connection}${profile.productHostVersion ? ` · ${profile.productHostVersion}` : ''}`;
}

function validateSample(sample) {
  if (
    !exactKeys(sample, [
      'id',
      'surface',
      'flow',
      'cacheState',
      'scenario',
      'expectedOutcome',
      'outcome',
      'measurement',
      'firstSoundMs',
      'capturedAt',
      'dav2',
      'hostTerminalReason'
    ])
  )
    return 'sample contains unknown or missing fields';
  if (typeof sample.id !== 'string' || sample.id.length < 3 || sample.id.length > 160) return 'sample.id is invalid';
  if (!SURFACES.includes(sample.surface)) return `sample.surface ${sample.surface} is unsupported`;
  if (!FLOWS.includes(sample.flow)) return `sample.flow ${sample.flow} is unsupported`;
  if (!CACHE_STATES.includes(sample.cacheState)) return `sample.cacheState ${sample.cacheState} is unsupported`;
  if (sample.flow === 'warm-next-track' && sample.cacheState !== 'warm') return 'warm-next-track samples must use cacheState=warm';
  if (!Object.hasOwn(SCENARIO_EXPECTATIONS, sample.scenario)) return 'sample.scenario is invalid';
  if (sample.expectedOutcome !== SCENARIO_EXPECTATIONS[sample.scenario]) return 'sample.expectedOutcome does not match the scenario contract';
  if (!['first-audio', 'error'].includes(sample.outcome)) return 'sample.outcome is invalid';
  if (sample.measurement !== (sample.outcome === 'first-audio' ? 'human-confirmed' : 'automatic-error')) return 'sample.measurement does not match its outcome';
  if (sample.outcome === 'first-audio' && (!Number.isFinite(sample.firstSoundMs) || sample.firstSoundMs < 0))
    return 'successful sample requires a non-negative firstSoundMs';
  if (sample.outcome === 'error' && sample.firstSoundMs !== null) return 'failed sample must use null firstSoundMs';
  if (sample.hostTerminalReason !== null && !HOST_TERMINAL_REASONS.includes(sample.hostTerminalReason)) return 'sample.hostTerminalReason is invalid';
  if (sample.outcome === 'first-audio' && sample.hostTerminalReason !== null) return 'successful sample cannot carry a terminal host reason';
  if (typeof sample.capturedAt !== 'string' || !Number.isFinite(Date.parse(sample.capturedAt))) return 'sample.capturedAt is invalid';
  if (
    !exactKeys(sample.dav2, [
      'observed',
      'fallback',
      'hedged',
      'gatewayRecovered',
      'intentPrefetched',
      'decryptor',
      'firstRangeBytes',
      'keyAuthorizationMs',
      'authenticationFailed'
    ])
  )
    return 'sample.dav2 contains unknown or missing fields';
  for (const field of ['observed', 'fallback', 'hedged', 'gatewayRecovered', 'intentPrefetched', 'authenticationFailed']) {
    if (typeof sample.dav2[field] !== 'boolean') return `sample.dav2.${field} must be boolean`;
  }
  if (![null, 'worker', 'main-thread'].includes(sample.dav2.decryptor)) return 'sample.dav2.decryptor is invalid';
  if (sample.dav2.firstRangeBytes !== null && (!Number.isSafeInteger(sample.dav2.firstRangeBytes) || sample.dav2.firstRangeBytes <= 0)) {
    return 'sample.dav2.firstRangeBytes is invalid';
  }
  if (sample.dav2.keyAuthorizationMs !== null && (!Number.isFinite(sample.dav2.keyAuthorizationMs) || sample.dav2.keyAuthorizationMs < 0))
    return 'sample.dav2.keyAuthorizationMs is invalid';
  if ((sample.dav2.authenticationFailed || sample.dav2.keyAuthorizationMs !== null) && !sample.dav2.observed)
    return 'DAV2 proof signals require dav2.observed=true';
  return null;
}

function controlledScenarioProofMatches(sample) {
  switch (sample.scenario) {
    case 'denied-protected':
      return sample.hostTerminalReason === 'access-denied';
    case 'broken-gateway':
      return sample.dav2.observed && sample.dav2.gatewayRecovered;
    case 'slow-key-service':
      return sample.dav2.observed && sample.dav2.keyAuthorizationMs !== null && sample.dav2.keyAuthorizationMs >= SLOW_KEY_PROOF_MS;
    case 'interrupted-navigation':
      return sample.hostTerminalReason === 'selection-interrupted';
    case 'corrupted-dav2':
      return sample.dav2.observed && sample.dav2.authenticationFailed;
    default:
      return true;
  }
}

export function validateFirstSoundEvidence(evidence) {
  const problems = [];
  if (!exactKeys(evidence, ['schemaVersion', 'candidate', 'profile', 'capturedAt', 'samples', 'privacy'])) {
    problems.push('evidence contains unknown or missing top-level fields');
    return problems;
  }
  if (evidence.schemaVersion !== 5) problems.push('schemaVersion must be 5');
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

function buildBudgetRow(samples, flow, cacheState, scope = {}) {
  const successful = samples
    .filter(sample => sample.flow === flow && sample.cacheState === cacheState && sample.outcome === 'first-audio')
    .map(sample => sample.firstSoundMs);
  const p75Ms = percentile(successful, 0.75);
  const targetMs = BUDGETS_MS[flow];
  return {
    ...scope,
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
        problems.length === 0 ? 'Sanitized schema v5 accepted.' : problems.join('; ')
      )
    );
    if (problems.length === 0) evidence.push(item.data);
  }

  const candidate = evidence[0]?.candidate ?? null;
  const profileGroups = [];
  const profileGroupsByKey = new Map();
  for (const item of evidence) {
    const key = profileKey(item.profile);
    let group = profileGroupsByKey.get(key);
    if (!group) {
      group = { key, profile: { ...item.profile }, exports: 0, samples: [] };
      profileGroupsByKey.set(key, group);
      profileGroups.push(group);
    }
    group.exports += 1;
    group.samples.push(...item.samples);
  }
  const profiles = profileGroups.map(group => ({ ...group.profile }));
  for (const [index, group] of profileGroups.entries()) {
    const profile = group.profile;
    gates.push(
      gate(
        `profile:${index}`,
        `Test profile · ${profile.surface}`,
        'pass',
        `${profileDetail(profile)} · ${group.exports} export${group.exports === 1 ? '' : 's'}`
      )
    );
  }
  const commitMismatch = candidate ? evidence.some(item => item.candidate.gitSha !== candidate.gitSha) : false;
  const standaloneConfigDigests = new Set(
    evidence.filter(item => item.samples.some(sample => !sample.surface.startsWith('product-'))).map(item => item.candidate.buildConfigDigest)
  );
  const productConfigDigests = new Set(
    evidence.filter(item => item.samples.some(sample => sample.surface.startsWith('product-'))).map(item => item.candidate.buildConfigDigest)
  );
  const candidateMismatch = commitMismatch || standaloneConfigDigests.size > 1 || productConfigDigests.size > 1;
  if (!candidate) gates.push(gate('candidate', 'Exact candidate', 'not-run', 'No valid evidence file supplied.'));
  else if (candidateMismatch)
    gates.push(
      gate(
        'candidate',
        'Exact candidate',
        'fail',
        commitMismatch
          ? 'Evidence files refer to different git commits.'
          : 'Evidence files mix public build configurations within the standalone or Product deployment family.'
      )
    );
  else if (options.expectedCommit && candidate.gitSha !== options.expectedCommit) {
    gates.push(gate('candidate', 'Exact candidate', 'fail', `Evidence SHA ${candidate.gitSha} does not match expected ${options.expectedCommit}.`));
  } else
    gates.push(
      gate(
        'candidate',
        'Exact candidate',
        'pass',
        `${candidate.gitSha} · standalone config ${[...standaloneConfigDigests][0]?.slice(0, 12) ?? 'none'} · Product config ${[...productConfigDigests][0]?.slice(0, 12) ?? 'none'} across ${evidence.length} evidence export${evidence.length === 1 ? '' : 's'}.`
      )
    );

  const samples = candidateMismatch ? [] : evidence.flatMap(item => item.samples);
  const ordinarySamples = samples.filter(sample => sample.scenario === 'ordinary-playback');
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
    const surfaceSamples = ordinarySamples.filter(sample => sample.surface === surface);
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

  const scenarios = CONTROLLED_SCENARIOS.map(scenario => {
    const scenarioSamples = samples.filter(sample => sample.scenario === scenario);
    const expectedOutcome = SCENARIO_EXPECTATIONS[scenario];
    const matched = scenarioSamples.filter(sample => sample.outcome === expectedOutcome && controlledScenarioProofMatches(sample)).length;
    const successfulTimings = scenarioSamples.filter(sample => sample.outcome === 'first-audio').map(sample => sample.firstSoundMs);
    const p75Ms = percentile(successfulTimings, 0.75);
    return {
      scenario,
      expectedOutcome,
      samples: scenarioSamples.length,
      matched,
      p75Ms,
      status: scenarioSamples.length === 0 ? 'not-run' : matched === scenarioSamples.length ? 'pass' : 'fail'
    };
  });
  for (const row of scenarios) {
    const timing = row.p75Ms === null ? '' : ` Observed p75 ${Math.round(row.p75Ms)} ms.`;
    gates.push(
      gate(
        `scenario:${row.scenario}`,
        `Controlled scenario · ${row.scenario}`,
        row.status,
        row.samples === 0
          ? `No evidence; expected ${row.expectedOutcome}.`
          : `${row.matched}/${row.samples} attempts produced the expected ${row.expectedOutcome} with scenario-specific telemetry proof.${timing}`
      )
    );
  }

  const budgets = BUDGET_CELLS.map(({ flow, cacheState }) => buildBudgetRow(ordinarySamples, flow, cacheState));
  for (const row of budgets) {
    gates.push(gate(`budget:${row.flow}:${row.cacheState}`, `Aggregate p75 · ${row.flow} · ${row.cacheState}`, row.status, budgetDetail(row)));
  }

  // Aggregate p75 remains useful as a rollout overview, but it cannot prove a
  // bound environment: exports from different devices, browsers, networks, or
  // Product hosts must never combine to satisfy the sample floor. Strict
  // readiness therefore owns one budget for every exact profile/cell pair.
  const profileBudgets = profileGroups.flatMap((group, profileIndex) => {
    const profileOrdinarySamples = group.samples.filter(sample => sample.scenario === 'ordinary-playback');
    if (profileOrdinarySamples.length === 0) return [];
    return BUDGET_CELLS.map(({ flow, cacheState }) =>
      buildBudgetRow(candidateMismatch ? [] : profileOrdinarySamples, flow, cacheState, {
        profileIndex,
        profile: { ...group.profile }
      })
    );
  });
  for (const row of profileBudgets) {
    gates.push(
      gate(
        `profile-budget:${row.profileIndex}:${row.flow}:${row.cacheState}`,
        `Profile p75 · ${row.profile.surface} · ${row.profile.device} · ${row.flow} · ${row.cacheState}`,
        row.status,
        budgetDetail(row)
      )
    );
  }

  const dav2Samples = ordinarySamples.filter(sample => sample.dav2.observed);
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
    schemaVersion: 5,
    candidate,
    profiles,
    counts,
    gates,
    matrix,
    scenarios,
    budgets,
    profileBudgets,
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
