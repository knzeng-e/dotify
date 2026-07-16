#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "docs/backlog/backlog.json");
const BACKLOG_DIR = path.join(ROOT, "docs/backlog");

const args = new Set(process.argv.slice(2));
const check = args.has("--check") || process.argv.length <= 2;
const live = args.has("--live");
const help = args.has("--help") || args.has("-h");

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
  fail(["Only --check is implemented. Keep external Project writes manual until the dry-run report is reviewed."]);
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
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    fail([`Invalid JSON in ${relative(MANIFEST_PATH)}: ${error.message}`]);
  }
}

function validateManifestShape(data, targetErrors) {
  if (data.version !== 1) targetErrors.push("manifest.version must be 1.");
  if (data.repository !== "knzeng-e/dotify") {
    targetErrors.push("manifest.repository must be knzeng-e/dotify.");
  }
  if (!data.project || data.project.owner !== "knzeng-e" || data.project.number !== 5) {
    targetErrors.push("manifest.project must target knzeng-e Project 5.");
  }
  if (!Array.isArray(data.items) || data.items.length === 0) {
    targetErrors.push("manifest.items must be a non-empty array.");
    return;
  }

  const ids = new Set();
  const issues = new Set();
  const requiredFields = ["Priority", "Track", "Phase", "Type", "Backlog doc"];
  for (const field of requiredFields) {
    if (!data.project.recommendedFields || !(field in data.project.recommendedFields)) {
      targetErrors.push(`manifest.project.recommendedFields missing ${field}.`);
    }
  }

  for (const item of data.items) {
    for (const key of ["id", "doc", "kind", "priority", "track", "phase"]) {
      if (!(key in item)) targetErrors.push(`item ${item.id ?? "<unknown>"} missing ${key}.`);
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

    if (item.kind !== "work" && item.kind !== "research" && item.kind !== "epic" && item.kind !== "record") {
      targetErrors.push(`item ${item.id} has invalid kind: ${item.kind}`);
    }
  }
}

function validateDocs(data, targetErrors, targetWarnings) {
  const activeWithoutIssue = [];

  for (const item of data.items ?? []) {
    const absoluteDoc = path.join(ROOT, item.doc ?? "");
    if (!item.doc || !absoluteDoc.startsWith(ROOT) || !existsSync(absoluteDoc)) {
      targetErrors.push(`item ${item.id} references missing doc: ${item.doc}`);
    }

    if (item.kind !== "record" && (item.issue === null || item.issue === undefined)) {
      activeWithoutIssue.push(item.id);
    }
  }

  if (activeWithoutIssue.length > 0) {
    targetWarnings.push(`active items without GitHub issue mapping: ${activeWithoutIssue.join(", ")}`);
  }
}

function validateTicketNumbers(targetWarnings) {
  const docs = readdirSync(BACKLOG_DIR).filter((name) => /^\d{2}-.*\.md$/.test(name));
  const byNumber = new Map();

  for (const doc of docs) {
    const ticket = doc.slice(0, 2);
    const group = byNumber.get(ticket) ?? [];
    group.push(doc);
    byNumber.set(ticket, group);
  }

  for (const [ticket, group] of byNumber.entries()) {
    if (group.length > 1) {
      targetWarnings.push(`duplicate numbered backlog docs for ${ticket}: ${group.join(", ")}`);
    }
  }
}

function validateLiveProject(data, targetErrors, targetWarnings) {
  const activeIssueItems = (data.items ?? []).filter(
    (item) => item.issue && item.kind !== "record" && item.phase !== "Record",
  );

  for (const item of activeIssueItems) {
    let issue;
    try {
      issue = JSON.parse(
        execFileSync(
          "gh",
          [
            "issue",
            "view",
            String(item.issue),
            "--repo",
            data.repository,
            "--json",
            "number,title,state,projectItems,labels",
          ],
          { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
        ),
      );
    } catch (error) {
      targetErrors.push(`gh issue view #${item.issue} failed: ${compact(error.stderr?.toString() || error.message)}`);
      continue;
    }

    const projectItems = Array.isArray(issue.projectItems) ? issue.projectItems : [];
    const inProject = projectItems.some((projectItem) => {
      const title = projectItem.project?.title ?? projectItem.title ?? "";
      const number = projectItem.project?.number ?? projectItem.number;
      return title === "Dotify sprints" || number === data.project.number;
    });

    if (!inProject) {
      targetWarnings.push(`#${item.issue} (${item.id}) is active locally but not visible in Project 5.`);
    }

    const hasBacklogLabel = (issue.labels ?? []).some((label) => label.name === "dotify-backlog");
    if (!hasBacklogLabel) {
      targetWarnings.push(`#${item.issue} (${item.id}) is missing label dotify-backlog.`);
    }
  }
}

function report({ errors, warnings, live: usedLive }) {
  const mode = usedLive ? "live" : "offline";
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
  console.error("backlog-sync check failed:");
  for (const message of messages) console.error(`- ${message}`);
  process.exit(1);
}

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function compact(value) {
  return value.replace(/\s+/g, " ").trim();
}
