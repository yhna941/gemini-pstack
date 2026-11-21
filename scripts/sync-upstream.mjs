#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const roots = ['skills', 'docs/guide'];

function walk(dir, base) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const rel = path.join(base, entry.name);
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(abs, rel));
    else if (entry.isFile()) out.push(rel.split(path.sep).join('/'));
  }
  return out;
}

function loadAllowlist(file) {
  if (!fs.existsSync(file)) return new Set();
  return new Set(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#')),
  );
}

export function compareTrees(localRoot, upstreamRoot, allow) {
  const drift = [];
  const missing = [];
  for (const relRoot of roots) {
    const upstreamFiles = walk(path.join(upstreamRoot, relRoot), relRoot);
    for (const rel of upstreamFiles) {
      const upstreamFile = path.join(upstreamRoot, rel);
      const localFile = path.join(localRoot, rel);
      if (!fs.existsSync(localFile)) {
        missing.push(rel);
        continue;
      }
      if (allow.has(rel)) continue;
      const left = fs.readFileSync(localFile);
      const right = fs.readFileSync(upstreamFile);
      if (!left.equals(right)) drift.push(rel);
    }
  }
  return { drift, missing };
}

function printReport(report, strict) {
  for (const rel of report.drift) console.error(`drift ${rel}`);
  for (const rel of report.missing) console.error(`missing ${rel}`);
  console.log(`drift ${report.drift.length} missing ${report.missing.length}`);
  if (report.drift.length > 0) return 1;
  if (strict && report.missing.length > 0) return 1;
  return 0;
}

function selfTest() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-sync-'));
  const up = path.join(dir, 'up');
  const local = path.join(dir, 'local');
  fs.mkdirSync(path.join(up, 'skills/kept'), { recursive: true });
  fs.mkdirSync(path.join(up, 'skills/changed'), { recursive: true });
  fs.mkdirSync(path.join(local, 'skills/kept'), { recursive: true });
  fs.mkdirSync(path.join(local, 'skills/changed'), { recursive: true });
  fs.writeFileSync(path.join(up, 'skills/kept/SKILL.md'), 'same\n');
  fs.writeFileSync(path.join(local, 'skills/kept/SKILL.md'), 'same\n');
  fs.writeFileSync(path.join(up, 'skills/changed/SKILL.md'), 'upstream\n');
  fs.writeFileSync(path.join(local, 'skills/changed/SKILL.md'), 'local\n');
  fs.mkdirSync(path.join(up, 'docs/guide'), { recursive: true });
  fs.writeFileSync(path.join(up, 'docs/guide/README.md'), 'guide\n');
  const drifted = compareTrees(local, up, new Set());
  if (drifted.drift.join(',') !== 'skills/changed/SKILL.md') {
    console.error('expected drift on skills/changed/SKILL.md', drifted);
    process.exit(1);
  }
  if (!drifted.missing.includes('docs/guide/README.md')) {
    console.error('expected missing guide', drifted);
    process.exit(1);
  }
  const allowed = compareTrees(local, up, new Set(['skills/changed/SKILL.md']));
  if (allowed.drift.length !== 0) {
    console.error('allowlist did not suppress drift', allowed);
    process.exit(1);
  }
  fs.mkdirSync(path.join(local, 'docs/guide'), { recursive: true });
  fs.writeFileSync(path.join(local, 'docs/guide/README.md'), 'guide\n');
  fs.writeFileSync(path.join(local, 'skills/changed/SKILL.md'), 'upstream\n');
  const clean = compareTrees(local, up, new Set());
  if (clean.drift.length || clean.missing.length) {
    console.error('expected a clean tree', clean);
    process.exit(1);
  }
  console.log('sync-upstream self-test passed');
}

function cloneUpstream(dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  const cloned = spawnSync(
    'git',
    ['clone', '--depth', '1', '--filter=blob:none', '--sparse', 'https://github.com/cursor/plugins.git', dest],
    { stdio: 'inherit' },
  );
  if (cloned.status !== 0) process.exit(cloned.status ?? 1);
  const sparse = spawnSync('git', ['sparse-checkout', 'set', 'pstack'], { cwd: dest, stdio: 'inherit' });
  if (sparse.status !== 0) process.exit(sparse.status ?? 1);
  return path.join(dest, 'pstack');
}

const argv = process.argv.slice(2);
if (argv.includes('--self-test')) {
  selfTest();
} else {
  const strict = argv.includes('--strict');
  const upstreamFlag = argv.indexOf('--upstream');
  const upstream =
    upstreamFlag === -1
      ? cloneUpstream(path.join(os.tmpdir(), 'cursor-plugins-pstack'))
      : argv[upstreamFlag + 1];
  const allow = loadAllowlist(path.join(root, 'scripts/upstream-allowlist.txt'));
  process.exit(printReport(compareTrees(root, upstream, allow), strict));
}
