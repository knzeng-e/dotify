#!/usr/bin/env node

// W13 pilot release readiness gate.
//
// This command is deliberately read-only. It reconciles local W01-W12 evidence,
// Product DevNet static/live journey evidence, the reversible release plan, and
// optional aggregate pilot evidence. Missing live/pilot inputs stay visible as
// blocked or not-run; only unsafe or inconsistent local release state exits
// non-zero.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { buildProductDevnetJourneyReport, gitCommit, readProductDevnetSnapshot, summarizeGates } from './product-devnet-journey-harness.mjs';

export const PILOT_RELEASE_SCHEMA_VERSION = 1;

const DEPENDENCIES = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06', 'W07', 'W08', 'W09', 'W10', 'W11', 'W12'];

const REQUIRED_RELEASE_PLAN_SECTIONS = [
  'Release Candidate',
  'Environment And Config Diff',
  'Contracts And Product Bundle',
  'Rollback',
  'Monitoring',
  'Supported Surfaces',
  'Pilot Protocol',
  'Data Collection',
  'Go/No-Go Record'
];

const REQUIRED_PILOT_TASKS = ['publish', 'startRoom', 'joinFromLinkOrQr', 'recoverAfterInterruption', 'inspectSplit', 'supportArtist'];

const SENSITIVE_KEYS = [
  'contentkey',
  'privatekey',
  'mnemonic',
  'seed',
  'signature',
  'sessiontoken',
  'nonce',
  'email',
  'phone',
  'ip',
  'walletaddress',
  'listeneraddress'
];

function gate(status, id, label, detail, source = 'local') {
  return { id, label, status, detail, source };
}

function pass(id, label, detail, source) {
  return gate('pass', id, label, detail, source);
}

function fail(id, label, detail, source) {
  return gate('fail', id, label, detail, source);
}

function blocked(id, label, detail, source) {
  return gate('blocked', id, label, detail, source);
}

function notRun(id, label, detail, source) {
  return gate('not-run', id, label, detail, source);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readOptionalJson(path) {
  return path ? readJson(path) : null;
}

function gitSubjects(repoRoot) {
  try {
    return execFileSync('git', ['-C', repoRoot, 'log', '--format=%s'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function gitMergeBase(repoRoot, left, right) {
  try {
    execFileSync('git', ['-C', repoRoot, 'merge-base', '--is-ancestor', left, right], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

function gitRefExists(repoRoot, ref) {
  try {
    execFileSync('git', ['-C', repoRoot, 'rev-parse', '--verify', `${ref}^{commit}`], {
      stdio: ['ignore', 'ignore', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

function extractPullNumber(text) {
  const urlMatch = text.match(/github\.com\/knzeng-e\/dotify\/pull\/(\d+)/i);
  if (urlMatch) return Number.parseInt(urlMatch[1], 10);

  const prMatch = text.match(/\b(?:PR|draft PR|ready-for-review PR)\s+#(\d+)/i);
  if (prMatch) return Number.parseInt(prMatch[1], 10);

  return null;
}

function extractLineValue(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lines = text.split('\n');
  const start = lines.findIndex(line => new RegExp(`^- ${escaped}:\\s*`).test(line));
  if (start === -1) return null;

  const first = lines[start].replace(new RegExp(`^- ${escaped}:\\s*`), '').trim();
  const continuations = [];
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ') && !line.startsWith('\t')) break;
    if (line.trim()) continuations.push(line.trim());
  }

  return [first, ...continuations].join(' ').trim();
}

export function evaluateDependencyEvidence(repoRoot) {
  const gates = [];
  const subjects = gitSubjects(repoRoot);
  const integrationRef = gitRefExists(repoRoot, 'origin/dev') ? 'origin/dev' : gitRefExists(repoRoot, 'dev') ? 'dev' : null;

  if (!integrationRef) {
    gates.push(notRun('candidate-includes-origin-dev', 'Candidate includes dev', 'No local dev/origin-dev ref is available in this checkout.', 'git'));
  } else if (gitMergeBase(repoRoot, integrationRef, 'HEAD')) {
    gates.push(pass('candidate-includes-origin-dev', 'Candidate includes dev', `HEAD contains ${integrationRef}.`, 'git'));
  } else {
    gates.push(fail('candidate-includes-origin-dev', 'Candidate includes dev', `HEAD does not contain ${integrationRef}.`, 'git'));
  }

  for (const id of DEPENDENCIES) {
    const path = resolve(repoRoot, `docs/backlog/implementation/evidence/${id}.md`);
    if (!existsSync(path)) {
      gates.push(fail(`dependency:${id}:evidence`, `${id} evidence`, 'Evidence file is missing.', path));
      continue;
    }

    const text = readFileSync(path, 'utf8');
    gates.push(pass(`dependency:${id}:evidence`, `${id} evidence`, 'Evidence file is present.', path));

    const pullNumber = extractPullNumber(text);
    if (!pullNumber) {
      gates.push(fail(`dependency:${id}:pr`, `${id} PR integration`, 'No PR number could be read from the evidence file.', path));
    } else if (subjects.some(subject => subject.includes(`(#${pullNumber})`) || subject.includes(`#${pullNumber}`))) {
      gates.push(pass(`dependency:${id}:pr`, `${id} PR integration`, `PR #${pullNumber} is present in local history.`, 'git log'));
    } else {
      gates.push(fail(`dependency:${id}:pr`, `${id} PR integration`, `PR #${pullNumber} was not found in local history.`, 'git log'));
    }

    const readiness = extractLineValue(text, 'Release readiness') ?? 'not recorded';
    gates.push(pass(`dependency:${id}:release-state`, `${id} release state`, readiness, path));
  }

  return gates;
}

export function evaluateReleasePackage(repoRoot) {
  const gates = [];
  const planPath = resolve(repoRoot, 'docs/operations/pilot-release-plan.md');

  if (!existsSync(planPath)) {
    gates.push(fail('release-plan', 'Pilot release plan', 'docs/operations/pilot-release-plan.md is missing.', planPath));
  } else {
    const text = readFileSync(planPath, 'utf8');
    gates.push(pass('release-plan', 'Pilot release plan', 'Reversible release plan is present.', planPath));

    for (const section of REQUIRED_RELEASE_PLAN_SECTIONS) {
      const heading = `## ${section}`;
      if (text.includes(heading)) {
        gates.push(pass(`release-plan:${section}`, section, 'Required section is present.', planPath));
      } else {
        gates.push(fail(`release-plan:${section}`, section, `Missing section heading "${heading}".`, planPath));
      }
    }

    if (/\b(TODO|TBD|FIXME)\b/i.test(text)) {
      gates.push(fail('release-plan:placeholders', 'Release plan placeholders', 'Plan contains TODO/TBD/FIXME placeholders.', planPath));
    } else {
      gates.push(pass('release-plan:placeholders', 'Release plan placeholders', 'No placeholder markers remain.', planPath));
    }
  }

  const sequence = readJson(resolve(repoRoot, 'docs/backlog/implementation/sequence.json'));
  const backlog = readJson(resolve(repoRoot, 'docs/backlog/backlog.json'));
  const w13 = sequence.sequences?.find(item => item.id === 'W13');
  const backlogW13 = backlog.items?.find(item => item.id === 'W13');

  if (w13?.issue === 158 && backlogW13?.issue === 158) {
    gates.push(pass('w13-issue-mapping', 'W13 issue mapping', 'W13 maps to GitHub issue #158 in sequence and backlog manifests.', 'backlog manifests'));
  } else {
    gates.push(fail('w13-issue-mapping', 'W13 issue mapping', 'Expected W13 issue #158 in sequence.json and backlog.json.', 'backlog manifests'));
  }

  return gates;
}

export function evaluateContractInventory(deployments) {
  const gates = [];
  const addresses = [
    ['factory', deployments.factory],
    ['directory', deployments.directory],
    ['initializer', deployments.initializer],
    ...Object.entries(deployments.pallets ?? {}).map(([name, value]) => [`pallets.${name}`, value])
  ];
  const invalid = addresses.filter(([, value]) => !/^0x[0-9a-fA-F]{40}$/.test(String(value ?? '')));

  if (invalid.length === 0) {
    gates.push(pass('contract-addresses', 'Contract address inventory', `${addresses.length} EVM addresses are well formed.`, 'deployments.json'));
  } else {
    gates.push(fail('contract-addresses', 'Contract address inventory', `Invalid addresses: ${invalid.map(([name]) => name).join(', ')}.`, 'deployments.json'));
  }

  const normalized = addresses.map(([, value]) => String(value).toLowerCase());
  if (new Set(normalized).size === normalized.length) {
    gates.push(pass('contract-address-uniqueness', 'Contract address uniqueness', 'No duplicate deployment addresses.', 'deployments.json'));
  } else {
    gates.push(fail('contract-address-uniqueness', 'Contract address uniqueness', 'Duplicate deployment address detected.', 'deployments.json'));
  }

  return gates;
}

function containsSensitiveData(value, path = []) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    if (/0x[0-9a-fA-F]{40}/.test(value)) return [...path, '<address-like-value>'].join('.');
    return null;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nested = containsSensitiveData(value[index], [...path, String(index)]);
      if (nested) return nested;
    }
    return null;
  }

  if (typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (SENSITIVE_KEYS.includes(normalized)) return [...path, key].join('.');
      const nested = containsSensitiveData(child, [...path, key]);
      if (nested) return nested;
    }
  }

  return null;
}

function taskSucceeded(value) {
  if (value === true) return true;
  if (value && typeof value === 'object') return value.status === 'pass' || value.completed === true;
  return false;
}

export function evaluatePilotEvidence(pilotEvidence) {
  const gates = [];

  if (!pilotEvidence) {
    gates.push(
      notRun(
        'pilot-sample',
        'Pilot sample',
        'No aggregate pilot evidence JSON was supplied. Target sample remains 3 artists, 5 hosts, and 20 listeners.',
        'pilot JSON'
      )
    );
    gates.push(
      notRun(
        'pilot-tasks',
        'Pilot tasks',
        'Publish, start room, join from link/QR, recover, inspect split, and support artist remain unobserved.',
        'pilot JSON'
      )
    );
    gates.push(notRun('pilot-join-target', 'Pilot join target', 'No 20-attempt join sample has been captured.', 'pilot JSON'));
    gates.push(
      notRun(
        'pilot-aggregate-privacy',
        'Pilot aggregate privacy',
        'No aggregate data record was supplied; do not infer consent or privacy boundaries.',
        'pilot JSON'
      )
    );
    gates.push(
      blocked('rollback-rehearsal', 'Rollback rehearsal', 'Rollback needs a safe-environment rehearsal against the candidate release package.', 'pilot JSON')
    );
    gates.push(notRun('go-no-go-record', 'Go/no-go record', 'No pilot decision or three prioritized fixes supplied.', 'pilot JSON'));
    return gates;
  }

  if (pilotEvidence.schemaVersion === PILOT_RELEASE_SCHEMA_VERSION) {
    gates.push(pass('pilot-schema', 'Pilot evidence schema', `schemaVersion ${PILOT_RELEASE_SCHEMA_VERSION}.`, 'pilot JSON'));
  } else {
    gates.push(
      fail(
        'pilot-schema',
        'Pilot evidence schema',
        `Expected schemaVersion ${PILOT_RELEASE_SCHEMA_VERSION}, found ${pilotEvidence.schemaVersion ?? 'missing'}.`,
        'pilot JSON'
      )
    );
  }

  const sensitivePath = containsSensitiveData(pilotEvidence);
  if (sensitivePath) {
    gates.push(fail('pilot-secret-hygiene', 'Pilot evidence privacy hygiene', `Sensitive or address-like field found at ${sensitivePath}.`, 'pilot JSON'));
  } else {
    gates.push(
      pass('pilot-secret-hygiene', 'Pilot evidence privacy hygiene', 'No keys, signatures, contact data, IPs, or wallet-like addresses detected.', 'pilot JSON')
    );
  }

  const participants = pilotEvidence.participants ?? {};
  const artists = Number(participants.artists ?? 0);
  const hosts = Number(participants.hosts ?? 0);
  const listeners = Number(participants.listeners ?? 0);
  if (artists >= 3 && hosts >= 5 && listeners >= 20) {
    gates.push(pass('pilot-sample', 'Pilot sample', `${artists} artists, ${hosts} hosts, ${listeners} listeners.`, 'pilot JSON'));
  } else {
    gates.push(
      notRun('pilot-sample', 'Pilot sample', `Expected at least 3 artists, 5 hosts, 20 listeners; got ${artists}/${hosts}/${listeners}.`, 'pilot JSON')
    );
  }

  const tasks = pilotEvidence.tasks ?? {};
  const missingTasks = REQUIRED_PILOT_TASKS.filter(task => !taskSucceeded(tasks[task]));
  if (missingTasks.length === 0) {
    gates.push(pass('pilot-tasks', 'Pilot tasks', 'All W13 pilot tasks are marked observed/pass.', 'pilot JSON'));
  } else {
    gates.push(notRun('pilot-tasks', 'Pilot tasks', `Missing or incomplete tasks: ${missingTasks.join(', ')}.`, 'pilot JSON'));
  }

  const observedAttempts = Number(pilotEvidence.joinAttempts?.observed ?? 0);
  const successfulAttempts = Number(pilotEvidence.joinAttempts?.successful ?? 0);
  const joinRate = observedAttempts > 0 ? successfulAttempts / observedAttempts : 0;
  if (observedAttempts >= 20 && joinRate >= 0.95) {
    gates.push(
      pass(
        'pilot-join-target',
        'Pilot join target',
        `${successfulAttempts}/${observedAttempts} successful supported-device joins (${Math.round(joinRate * 1000) / 10}%).`,
        'pilot JSON'
      )
    );
  } else {
    gates.push(
      notRun(
        'pilot-join-target',
        'Pilot join target',
        `Target is >=95% over >=20 observed attempts; got ${successfulAttempts}/${observedAttempts}.`,
        'pilot JSON'
      )
    );
  }

  const privacy = pilotEvidence.privacy ?? {};
  if (
    privacy.consentCaptured === true &&
    privacy.aggregateOnly === true &&
    privacy.continuousLocationCollected === false &&
    privacy.walletLinkedListeningHistoryCollected === false &&
    privacy.rawInterviewResponsesStored === false
  ) {
    gates.push(pass('pilot-aggregate-privacy', 'Pilot aggregate privacy', 'Consent and aggregate-only boundaries are explicit.', 'pilot JSON'));
  } else {
    gates.push(
      fail(
        'pilot-aggregate-privacy',
        'Pilot aggregate privacy',
        'Expected consentCaptured=true, aggregateOnly=true, and no continuous location, wallet-linked histories, or raw interviews.',
        'pilot JSON'
      )
    );
  }

  const rollback = pilotEvidence.rollback ?? {};
  if (rollback.rehearsed === true && rollback.catalogKeyCompatibility === 'passed') {
    gates.push(pass('rollback-rehearsal', 'Rollback rehearsal', 'Safe rollback rehearsal passed and catalog/key compatibility was confirmed.', 'pilot JSON'));
  } else {
    gates.push(blocked('rollback-rehearsal', 'Rollback rehearsal', 'Expected rollback.rehearsed=true and catalogKeyCompatibility="passed".', 'pilot JSON'));
  }

  const decision = pilotEvidence.goNoGo?.decision;
  const fixes = pilotEvidence.goNoGo?.prioritizedFixes;
  if ((decision === 'go' || decision === 'no-go' || decision === 'hold') && Array.isArray(fixes) && fixes.length === 3) {
    gates.push(pass('go-no-go-record', 'Go/no-go record', `Decision ${decision} with three prioritized fixes.`, 'pilot JSON'));
  } else {
    gates.push(notRun('go-no-go-record', 'Go/no-go record', 'Expected decision go/no-go/hold and exactly three prioritized fixes.', 'pilot JSON'));
  }

  return gates;
}

function renderGateTable(gates) {
  return [
    '| Gate | Status | Detail | Source |',
    '| --- | --- | --- | --- |',
    ...gates.map(item => `| ${escapePipes(item.label)} | ${item.status} | ${escapePipes(item.detail)} | ${escapePipes(item.source)} |`)
  ].join('\n');
}

function escapePipes(value) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildInventory(snapshot) {
  const appVersionMatch = snapshot.productDeployConfigText.match(/appVersion\s*:\s*\[([^\]]+)\]/m);
  const appVersion = appVersionMatch ? `[${appVersionMatch[1].replace(/\s+/g, ' ')}]` : 'unknown';
  return {
    productId: snapshot.env.VITE_DOTIFY_PRODUCT_ID,
    publicAppUrl: snapshot.env.VITE_PUBLIC_APP_URL,
    apiUrl: snapshot.env.VITE_DOTIFY_API_URL,
    signalUrl: snapshot.env.VITE_SIGNAL_URL,
    assetHubRpcUrl: snapshot.env.VITE_ETH_RPC_URL,
    appVersion,
    factory: snapshot.deployments.factory,
    directory: snapshot.deployments.directory,
    initializer: snapshot.deployments.initializer,
    pallets: snapshot.deployments.pallets
  };
}

export function buildPilotReleaseReport(input) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const snapshot = input.snapshot ?? readProductDevnetSnapshot(input.repoRoot);
  const productJourney = buildProductDevnetJourneyReport({
    snapshot,
    productSmokeEvidence: input.productSmokeEvidence,
    roomEvidence: input.roomEvidence,
    commit: input.commit,
    generatedAt
  });
  const dependencyGates = evaluateDependencyEvidence(input.repoRoot);
  const releasePackageGates = evaluateReleasePackage(input.repoRoot);
  const contractGates = evaluateContractInventory(snapshot.deployments);
  const pilotGates = evaluatePilotEvidence(input.pilotEvidence);
  const gates = [
    ...dependencyGates,
    ...releasePackageGates,
    ...contractGates,
    ...productJourney.staticGates,
    ...productJourney.productSmokeGates,
    ...productJourney.roomGates,
    ...pilotGates
  ];

  return {
    schemaVersion: PILOT_RELEASE_SCHEMA_VERSION,
    generatedAt,
    commit: input.commit,
    summary: summarizeGates(gates),
    inventory: buildInventory(snapshot),
    dependencyGates,
    releasePackageGates,
    contractGates,
    productJourney,
    pilotGates
  };
}

export function renderPilotReleaseMarkdown(report) {
  return [
    '# W13 Pilot Release Readiness',
    '',
    `Generated: ${report.generatedAt}`,
    `Candidate commit: \`${report.commit}\``,
    `Summary: **${report.summary.status}** (${report.summary.passCount} pass, ${report.summary.failCount} fail, ${report.summary.blockedCount} blocked, ${report.summary.notRunCount} not run)`,
    '',
    '## Release Inventory',
    '',
    `- Product ID: \`${report.inventory.productId}\``,
    `- Public Product URL: ${report.inventory.publicAppUrl}`,
    `- API: ${report.inventory.apiUrl}`,
    `- Signaling: ${report.inventory.signalUrl}`,
    `- Asset Hub RPC: ${report.inventory.assetHubRpcUrl}`,
    `- Product executable appVersion: \`${report.inventory.appVersion}\``,
    `- Factory: \`${report.inventory.factory}\``,
    `- ArtistDirectory: \`${report.inventory.directory}\``,
    `- Initializer: \`${report.inventory.initializer}\``,
    '',
    '## Dependency Evidence',
    '',
    renderGateTable(report.dependencyGates),
    '',
    '## Release Package',
    '',
    renderGateTable([...report.releasePackageGates, ...report.contractGates]),
    '',
    '## Product DevNet Static Gates',
    '',
    renderGateTable(report.productJourney.staticGates),
    '',
    '## Product CDM Host Smoke',
    '',
    renderGateTable(report.productJourney.productSmokeGates),
    '',
    '## Product Room Smoke',
    '',
    renderGateTable(report.productJourney.roomGates),
    '',
    '## Pilot Aggregate Evidence',
    '',
    renderGateTable(report.pilotGates),
    '',
    '## Surface Matrix',
    '',
    '| Surface | Build SHA | App version | Status | Evidence |',
    '| --- | --- | --- | --- | --- |',
    ...report.productJourney.surfaceMatrix.map(
      row => `| ${escapePipes(row.surface)} | \`${row.buildSha}\` | ${escapePipes(row.appVersion)} | ${row.status} | ${escapePipes(row.evidence)} |`
    ),
    '',
    '## Live Inputs',
    '',
    '- Product CDM payment/key smoke: pass `--product-smoke-json <product-cdm-host-smoke.json>` after running the explicit Product CDM smoke build in a funded Product host.',
    '- Product room smoke: pass `--room-json <room-evidence.json>` after a Product host shares a canonical room link and a browser guest hears audio without connecting an account.',
    '- Pilot aggregate: pass `--pilot-json <aggregate-pilot-evidence.json>` after owner-authorized participant sessions. Store aggregate counts and timings only.'
  ].join('\n');
}

export function parseArgs(argv) {
  const args = {
    repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), '../..'),
    productSmokeJson: null,
    roomJson: null,
    pilotJson: null,
    jsonOut: null,
    mdOut: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    const next = argv[index + 1];
    if (value === '--repo-root' && next) {
      args.repoRoot = resolve(next);
      index += 1;
    } else if ((value === '--product-smoke-json' || value === '--smoke-json') && next) {
      args.productSmokeJson = resolve(next);
      index += 1;
    } else if (value === '--room-json' && next) {
      args.roomJson = resolve(next);
      index += 1;
    } else if (value === '--pilot-json' && next) {
      args.pilotJson = resolve(next);
      index += 1;
    } else if (value === '--json-out' && next) {
      args.jsonOut = resolve(next);
      index += 1;
    } else if (value === '--md-out' && next) {
      args.mdOut = resolve(next);
      index += 1;
    } else if (value === '--help') {
      args.help = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${value}`);
    }
  }

  return args;
}

function help() {
  return `Usage: npm run smoke:pilot-release -- [--product-smoke-json <file>] [--room-json <file>] [--pilot-json <file>] [--json-out <file>] [--md-out <file>]

Reconciles W13 pilot-release readiness from checked-in evidence, Product DevNet
configuration, optional live Product/room smoke exports, and optional aggregate
pilot evidence. The command exits non-zero only when local release state is
unsafe or inconsistent. Missing live/pilot evidence is reported as blocked or
not-run.`;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(help());
    return 0;
  }

  const report = buildPilotReleaseReport({
    repoRoot: args.repoRoot,
    productSmokeEvidence: readOptionalJson(args.productSmokeJson),
    roomEvidence: readOptionalJson(args.roomJson),
    pilotEvidence: readOptionalJson(args.pilotJson),
    commit: gitCommit(args.repoRoot)
  });
  const markdown = renderPilotReleaseMarkdown(report);

  if (args.jsonOut) writeFileSync(args.jsonOut, `${JSON.stringify(report, null, 2)}\n`);
  if (args.mdOut) writeFileSync(args.mdOut, `${markdown}\n`);

  console.log(markdown);
  return report.summary.failCount > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then(code => {
      process.exitCode = code;
    })
    .catch(error => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
