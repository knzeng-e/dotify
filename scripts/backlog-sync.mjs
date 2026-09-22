#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'docs/backlog/backlog.json');
const BACKLOG_DIR = path.join(ROOT, 'docs/backlog');

const args = new Set(process.argv.slice(2));
const check = args.has('--check') || process.argv.length <= 2;
const live = args.has('--live');
const help = args.has('--help') || args.has('-h');

if (help) {
  console.log(`Usage:
  node scripts/backlog-sync.mjs --check --offline
  node scripts/backlog-sync.mjs --check --live

Offline checks validate the local manifest, referenced docs, duplicate ticket
numbers, and required Project field recommendations. Live checks also query
GitHub through gh and report issues missing from Project 5.`);
  process.exit(0);
}

if (!check) {
  fail(['Only --check is implemented. Keep external Project writes manual until the dry-run report is reviewed.']);
}

const errors = [];
const warnings = [];
const manifest = readManifest();

validateManifestShape(manifest, errors);
validateDocs(manifest, errors, warnings);
validateTicketNumbers(warnings);

if (live) {
  validateLiveProject(manifest, errors, warnings);
}

report({ errors, warnings, live });

function readManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    fail([`Missing manifest: ${relative(MANIFEST_PATH)}`]);
  }

  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch (error) {
    fail([`Invalid JSON in ${relative(MANIFEST_PATH)}: ${error.message}`]);
  }
}

function validateManifestShape(data, targetErrors) {
  if (data.version !== 1) targetErrors.push('manifest.version must be 1.');
  if (data.repository !== 'knzeng-e/dotify') {
    targetErrors.push('manifest.repository must be knzeng-e/dotify.');
  }
  if (!data.project || data.project.owner !== 'knzeng-e' || data.project.number !== 5) {
    targetErrors.push('manifest.project must target knzeng-e Project 5.');
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    targetErrors.push('manifest.items must be a non-empty array.');
    return;
  }

  const ids = new Set();
  const issues = new Set();
  const requiredFields = ['Priority', 'Track', 'Phase', 'Type', 'Backlog doc'];
  for (const field of requiredFields) {
    if (!data.project.recommendedFields || !(field in data.project.recommendedFields)) {
      targetErrors.push(`manifest.project.recommendedFields missing ${field}.`);
    }
  }

  for (const item of data.items) {
    for (const key of ['id', 'doc', 'kind', 'priority', 'track', 'phase']) {
      if (!(key in item)) targetErrors.push(`item ${item.id ?? '<unknown>'} missing ${key}.`);
    }

    if (ids.has(item.id)) targetErrors.push(`duplicate item id: ${item.id}`);
    ids.add(item.id);

    if (item.issue !== null && item.issue !== undefined) {
      if (!Number.isInteger(item.issue) || item.issue <= 0) {
        targetErrors.push(`item ${item.id} has invalid issue number: ${item.issue}`);
      }
      if (issues.has(item.issue)) {
        targetErrors.push(`duplicate GitHub issue mapping: #${item.issue}`);
      }
      issues.add(item.issue);
    }

    if (item.kind !== 'work' && item.kind !== 'research' && item.kind !== 'epic' && item.kind !== 'record') {
      targetErrors.push(`item ${item.id} has invalid kind: ${item.kind}`);
    }
  }
}

function validateDocs(data, targetErrors, targetWarnings) {
  const activeWithoutIssue = [];

  for (const item of data.items ?? []) {
    const absoluteDoc = path.join(ROOT, item.doc ?? '');
    if (!item.doc || !absoluteDoc.startsWith(ROOT) || !existsSync(absoluteDoc)) {
      targetErrors.push(`item ${item.id} references missing doc: ${item.doc}`);
    }

    if (item.kind !== 'record' && (item.issue === null || item.issue === undefined)) {
      activeWithoutIssue.push(item.id);
    }
  }

  if (activeWithoutIssue.length > 0) {
    targetWarnings.push(`active items without GitHub issue mapping: ${activeWithoutIssue.join(', ')}`);
  }
}

function validateTicketNumbers(targetWarnings) {
  const docs = readdirSync(BACKLOG_DIR).filter(name => /^\d{2}-.*\.md$/.test(name));
  const byNumber = new Map();

  for (const doc of docs) {
    const ticket = doc.slice(0, 2);
    const group = byNumber.get(ticket) ?? [];
    group.push(doc);
    byNumber.set(ticket, group);
  }

  for (const [ticket, group] of byNumber.entries()) {
    if (group.length > 1) {
      targetWarnings.push(`duplicate numbered backlog docs for ${ticket}: ${group.join(', ')}`);
    }
  }
}

function validateLiveProject(data, targetErrors, targetWarnings) {
  const issueItems = (data.items ?? []).filter(item => item.issue);
  let issues;
  let project;

  try {
    issues = runGhJson(['issue', 'list', '--repo', data.repository, '--state', 'all', '--limit', '1000', '--json', 'number,title,state,labels']);
  } catch (error) {
    targetErrors.push(`GitHub issue inventory failed: ${compact(error.stderr?.toString() || error.message)}`);
    return;
  }

  try {
    project = runGhJson(['project', 'item-list', String(data.project.number), '--owner', data.project.owner, '--limit', '1000', '--format', 'json']);
  } catch (error) {
    targetErrors.push(`Project ${data.project.number} inventory failed: ${compact(error.stderr?.toString() || error.message)}`);
    return;
  }

  const issuesByNumber = new Map((issues ?? []).map(issue => [issue.number, issue]));
  const projectByIssue = new Map();

  for (const projectItem of project.items ?? []) {
    if (projectItem.content?.type !== 'Issue') continue;
    if (projectItem.content?.repository !== data.repository) continue;
    const number = projectItem.content.number;
    const existing = projectByIssue.get(number) ?? [];
    existing.push(projectItem);
    projectByIssue.set(number, existing);
  }

  for (const item of issueItems) {
    const issue = issuesByNumber.get(item.issue);
    if (!issue) {
      targetErrors.push(`#${item.issue} (${item.id}) is mapped locally but missing from the repository issue inventory.`);
      continue;
    }

    const matchingCards = projectByIssue.get(item.issue) ?? [];
    if (matchingCards.length > 1) {
      targetErrors.push(`#${item.issue} (${item.id}) has ${matchingCards.length} issue cards in Project ${data.project.number}.`);
      continue;
    }

    const card = matchingCards[0];
    const isRecord = item.kind === 'record' || item.phase === 'Record';
    const expectedIssueState = isRecord ? 'CLOSED' : 'OPEN';

    if (issue.state !== expectedIssueState) {
      targetErrors.push(`#${item.issue} (${item.id}) is ${issue.state}, but local ${isRecord ? 'record' : 'active'} scope requires ${expectedIssueState}.`);
    }

    if (!card && !isRecord && data.policy.activeItemsNeedProjectCard) {
      targetErrors.push(`#${item.issue} (${item.id}) is active locally but absent from Project ${data.project.number}.`);
    }

    if (card) validateProjectCard(item, issue, card, isRecord, targetErrors);

    const hasBacklogLabel = (issue.labels ?? []).some(label => label.name === 'dotify-backlog');
    if (!isRecord && !hasBacklogLabel) {
      targetWarnings.push(`#${item.issue} (${item.id}) is missing label dotify-backlog.`);
    }
  }
}

function validateProjectCard(item, issue, card, isRecord, targetErrors) {
  const expectedStatus = isRecord ? 'Done' : null;
  if (expectedStatus && card.status !== expectedStatus) {
    targetErrors.push(`#${issue.number} (${item.id}) is a record but its Project status is ${card.status ?? 'unset'}, not Done.`);
  }
  if (!isRecord && card.status === 'Done') {
    targetErrors.push(`#${issue.number} (${item.id}) is active but its Project status is Done.`);
  }

  const expected = {
    priority: item.priority,
    track: item.track,
    phase: item.phase,
    type: titleCase(item.kind),
    'backlog doc': item.doc
  };

  for (const [field, value] of Object.entries(expected)) {
    if (card[field] !== value) {
      targetErrors.push(`#${issue.number} (${item.id}) Project ${field} is ${JSON.stringify(card[field] ?? null)}, expected ${JSON.stringify(value)}.`);
    }
  }
}

function runGhJson(argumentsList) {
  return JSON.parse(
    execFileSync('gh', argumentsList, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    })
  );
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function report({ errors, warnings, live: usedLive }) {
  const mode = usedLive ? 'live' : 'offline';
  if (warnings.length > 0) {
    console.log(`backlog-sync ${mode} warnings:`);
    for (const warning of warnings) console.log(`- ${warning}`);
  }

  if (errors.length > 0) {
    fail(errors);
  }

  console.log(`backlog-sync ${mode} check passed.`);
}

function fail(messages) {
  console.error('backlog-sync check failed:');
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function compact(value) {
  return value.replace(/\s+/g, ' ').trim();
}
