#!/usr/bin/env node
// Offline operator diagnostics. Never import the application, transport or signer.
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const MAX_BYTES = 16 * 1024 * 1024;
const MAX_RECORD_BYTES = 64 * 1024;
const MAX_RECORDS = 10_000;
const MAX_SAMPLES = 1_000;
const JOB = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHASES = new Set(['queue', 'prepare', 'status', 'nextNonce', 'lookup', 'readBlock', 'lookupSubmission', 'store', 'submitAndFinalize']);
const MILESTONES = new Set(['created', 'broadcasted', 'firstInclusion']);
const KINDS = new Set(['audio', 'cover', 'metadata']);

class ReportRefused extends Error {}
const refuse = message => {
  throw new ReportRefused(message);
};
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;

// fly logs --json emits concatenated pretty objects; JSONL is the same grammar.
// Frame only bounded top-level objects, respecting quotes/escapes. JSON.parse
// validates their actual syntax; never search arbitrary error text for reports.
function records(text) {
  const result = [];
  let offset = 0;
  while (offset < text.length) {
    while (/\s/.test(text[offset] ?? '') && offset < text.length) offset++;
    if (offset === text.length) break;
    if (text[offset] !== '{' || result.length >= MAX_RECORDS) refuse('Invalid or excessive log records.');
    const start = offset;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    do {
      const character = text[offset++];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === '{' || character === '[') depth++;
      else if (character === '}' || character === ']') depth--;
      if (offset - start > MAX_RECORD_BYTES) refuse('Log record exceeds the size limit.');
    } while (offset < text.length && depth > 0);
    if (quoted || depth !== 0) refuse('Incomplete log record.');
    const raw = text.slice(start, offset);
    if (Buffer.byteLength(raw) > MAX_RECORD_BYTES) refuse('Log record exceeds the size limit.');
    try {
      result.push(JSON.parse(raw));
    } catch {
      refuse('Invalid JSON log record.');
    }
  }
  return result;
}

function counters(value, fields) {
  if (!object(value) || Object.keys(value).length !== fields.length || fields.some(field => !integer(value[field]))) refuse('Invalid timing counters.');
  return Object.fromEntries(fields.map(field => [field, value[field]]));
}

function timings(value, allowed, milestone = false) {
  if (!object(value)) refuse('Missing timing collection.');
  return Object.fromEntries(
    Object.entries(value).map(([name, timing]) => {
      if (!allowed.has(name)) refuse('Unsupported timing phase or milestone.');
      const fields = milestone ? ['observations', 'totalMs', 'maxMs'] : ['calls', 'failures', 'totalMs', 'maxMs', 'peakConcurrency', 'inFlightAtReport'];
      const clean = counters(timing, fields);
      const count = milestone ? clean.observations : clean.calls;
      if (count < 1 || clean.maxMs > clean.totalMs) refuse('Inconsistent timing counters.');
      if (
        !milestone &&
        (clean.failures > clean.calls - clean.inFlightAtReport ||
          clean.peakConcurrency < 1 ||
          clean.peakConcurrency > clean.calls ||
          clean.inFlightAtReport > clean.peakConcurrency)
      )
        refuse('Inconsistent timing counters.');
      return [name, clean];
    })
  );
}

function timingRecord(envelope) {
  let value = envelope;
  if (typeof envelope.message === 'string') {
    try {
      value = JSON.parse(envelope.message);
    } catch {
      return null; // Normal Fly/system text is not a timing event.
    }
  }
  if (!object(value) || (value.code !== 'BULLETIN_PUBLICATION_TIMING' && value.schema !== 'dotify.bulletin.publication-timing.v1')) return null;
  if (
    (value.code !== undefined && value.code !== 'BULLETIN_PUBLICATION_TIMING') ||
    value.schema !== 'dotify.bulletin.publication-timing.v1' ||
    value.scope !== 'publisher-attempt' ||
    !['succeeded', 'failed'].includes(value.outcome) ||
    !integer(value.elapsedMs) ||
    (value.kind !== undefined && !KINDS.has(value.kind)) ||
    (value.jobId !== undefined && (typeof value.jobId !== 'string' || !JOB.test(value.jobId)))
  )
    refuse('Unsupported or invalid publication timing report.');
  const phases = timings(value.phases, PHASES);
  const milestones = timings(value.milestones, MILESTONES, true);
  const observed = envelope.timestamp ?? value.time;
  let observedAt = null;
  if (observed !== undefined) {
    if ((typeof observed !== 'string' && typeof observed !== 'number') || !Number.isFinite(new Date(observed).getTime()))
      refuse('Invalid timing observation timestamp.');
    observedAt = new Date(observed).toISOString();
  }
  return { jobId: value.jobId, kind: value.kind ?? null, observedAt, outcome: value.outcome, elapsedMs: value.elapsedMs, phases, milestones };
}

/** No network, environment fallback, attempt aggregation, deduplication or ETA. */
export function summarizeBulletinTimings(text, { jobId } = {}) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) refuse('Input exceeds the size limit.');
  if (jobId !== undefined && (typeof jobId !== 'string' || !JOB.test(jobId))) refuse('Invalid job filter.');
  const input = records(text);
  const jobs = new Map();
  const samples = [];
  for (const envelope of input) {
    const event = timingRecord(envelope);
    if (!event || (jobId !== undefined && event.jobId !== jobId)) continue;
    if (samples.length >= MAX_SAMPLES) refuse('Too many timing samples.');
    if (event.jobId && !jobs.has(event.jobId)) jobs.set(event.jobId, jobs.size + 1);
    const { jobId: originalJob, ...clean } = event;
    samples.push({ sample: samples.length + 1, job: originalJob ? jobs.get(originalJob) : null, ...clean });
  }
  if (!samples.length) refuse('No matching publication timing report.');
  return {
    schema: 'dotify.bulletin.timing-summary.v1',
    inputSha256: createHash('sha256').update(text).digest('hex'),
    recordCount: input.length,
    sampleCount: samples.length,
    interpretation: {
      elapsedScope: 'publisher-attempt',
      phaseTotalsAreNotAdditive: true,
      duplicateRecordsAreRetained: true,
      endToEndPublicationMeasured: false
    },
    samples
  };
}

export async function writeTimingSummary(input, output, options) {
  if (resolve(input) === resolve(output)) refuse('Use a new output path.');
  const handle = await open(input, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let text;
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(MAX_BYTES) || before.uid !== BigInt(process.getuid()) || before.mode & 0o077n)
      refuse('Input must be a bounded private owned regular file.');
    const bytes = Buffer.alloc(Number(before.size) + 1);
    let length = 0;
    while (length < bytes.length) {
      const { bytesRead } = await handle.read(bytes, length, bytes.length - length, length);
      if (!bytesRead) break;
      length += bytesRead;
    }
    const after = await handle.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) refuse('Input changed during reading.');
    if (length !== Number(before.size)) refuse('Input changed during reading.');
    try {
      text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes.subarray(0, length));
    } catch {
      refuse('Input must contain valid UTF-8.');
    }
  } finally {
    await handle.close();
  }
  const summary = summarizeBulletinTimings(text, options);
  // O_EXCL refuses existing files and symlinks. The sanitized report is never
  // a custody journal; an interrupted output must be retried at a new path.
  const destination = await open(output, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    await destination.writeFile(JSON.stringify(summary, null, 2) + '\n');
    await destination.sync();
  } finally {
    await destination.close();
  }
  return summary.sampleCount;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { values } = parseArgs({ options: { input: { type: 'string' }, output: { type: 'string' }, job: { type: 'string' }, help: { type: 'boolean' } } });
    if (values.help) {
      console.log(
        'Usage: node scripts/summarize-bulletin-timings.mjs --input PRIVATE_LOG --output NEW_REPORT [--job UUID]\nOffline only. Phase totals overlap; publisher time is not full-publication time.'
      );
    } else {
      if (!values.input || !values.output) refuse('Explicit input and new output are required.');
      const count = await writeTimingSummary(values.input, values.output, { jobId: values.job });
      console.log(`Timing summary written (${count} samples).`);
    }
  } catch (error) {
    console.error(`TIMING_REPORT_REFUSED: ${error instanceof ReportRefused ? error.message : 'Check the private input and new output path.'}`);
    process.exitCode = 1;
  }
}
