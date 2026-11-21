#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function parseQuoted(rest) {
  const quote = rest[0];
  if (quote !== '"' && quote !== "'") return null;
  let out = '';
  for (let i = 1; i < rest.length; i++) {
    const ch = rest[i];
    if (ch === '\\') {
      out += rest[i + 1] ?? '';
      i++;
      continue;
    }
    if (ch === quote) return { value: out, end: i + 1 };
    out += ch;
  }
  return null;
}

function field(body, key) {
  const match = new RegExp(`^${key}\\s*:\\s*`, 'm').exec(body);
  if (!match) return null;
  const rest = body.slice(match.index + match[0].length);
  if (rest.startsWith('"') || rest.startsWith("'")) {
    const parsed = parseQuoted(rest);
    return parsed ? parsed.value : null;
  }
  const line = rest.split(/\r?\n/, 1)[0].trim();
  return line.length > 0 ? line : null;
}

function frontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return match[1];
}

function parseCommandToml(text, file) {
  const description = text.match(/^description\s*=\s*"((?:\\.|[^"\\])*)"\s*$/m);
  const prompt = text.match(/prompt\s*=\s*"""\n([\s\S]*?)\n"""\s*$/);
  if (!description) fail(`${file} needs description = "..." on one line`);
  if (!prompt) fail(`${file} needs prompt as a """ multiline string`);
  if (prompt && prompt[1].trim().length === 0) fail(`${file} has an empty prompt`);
  if (prompt && prompt[1].includes('"""')) fail(`${file} prompt contains a nested """`);
  if (prompt && prompt[1].includes('!{')) {
    fail(`${file} prompt injects a shell command`);
  }
  if (prompt && !prompt[1].includes('{{args}}')) {
    fail(`${file} prompt does not include {{args}}`);
  }
}

function checkManifest() {
  let manifest;
  try {
    manifest = JSON.parse(read('gemini-extension.json'));
  } catch (err) {
    fail(`gemini-extension.json is not JSON. ${err.message}`);
    return;
  }
  if (manifest.name !== 'pstack') fail('extension name must be pstack');
  if (!/^[a-z0-9-]+$/.test(manifest.name ?? '')) {
    fail('extension name must be lowercase letters, numbers, and dashes');
  }
  if (!/^\d+\.\d+\.\d+$/.test(manifest.version ?? '')) {
    fail('version must be plain semver');
  }
  if (typeof manifest.description !== 'string' || manifest.description.length === 0) {
    fail('description must be a non-empty string');
  }
  if (manifest.contextFileName !== 'GEMINI.md') {
    fail('contextFileName must be GEMINI.md');
  }
  if (!fs.existsSync(path.join(root, 'GEMINI.md'))) fail('GEMINI.md is missing');
  const allowed = new Set(['name', 'version', 'description', 'contextFileName']);
  for (const key of Object.keys(manifest)) {
    if (!allowed.has(key)) fail(`unexpected manifest key ${key}`);
  }
}

function checkCommands() {
  const dir = path.join(root, 'commands');
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.toml'));
  const expected = [
    'poteto-mode.toml',
    'setup-pstack.toml',
    'investigation.toml',
    'bug-fix.toml',
    'feature.toml',
    'verification.toml',
  ];
  for (const name of expected) {
    if (!files.includes(name)) fail(`missing commands/${name}`);
  }
  for (const name of files) {
    if (!/^[a-z0-9-]+\.toml$/.test(name)) fail(`command file name ${name} is not a slash-command slug`);
    parseCommandToml(read(path.join('commands', name)), `commands/${name}`);
  }
}

function checkSkills() {
  const skillsDir = path.join(root, 'skills');
  const dirs = fs.readdirSync(skillsDir);
  for (const dir of dirs) {
    const skill = path.join(skillsDir, dir, 'SKILL.md');
    if (!fs.existsSync(skill)) {
      fail(`skills/${dir} has no SKILL.md`);
      continue;
    }
    const body = frontmatter(fs.readFileSync(skill, 'utf8'));
    if (!body) {
      fail(`skills/${dir}/SKILL.md has no frontmatter`);
      continue;
    }
    const name = field(body, 'name');
    const description = field(body, 'description');
    if (!name) fail(`skills/${dir} is missing name`);
    if (name !== dir) fail(`skills/${dir} name is ${name}`);
    if (!description) fail(`skills/${dir} is missing description`);
  }
  const playbooks = [
    'investigation.md',
    'bug-fix.md',
    'feature.md',
    'verification.md',
    'opening-a-pr.md',
  ];
  for (const name of playbooks) {
    const file = path.join(root, 'skills/poteto-mode/playbooks', name);
    if (!fs.existsSync(file)) fail(`missing playbook ${name}`);
  }
}

function checkAgents() {
  const allowed = new Set([
    'kind',
    'name',
    'description',
    'display_name',
    'tools',
    'mcp_servers',
    'model',
    'temperature',
    'max_turns',
    'timeout_mins',
  ]);
  const agentsDir = path.join(root, 'agents');
  for (const file of fs.readdirSync(agentsDir)) {
    if (!file.endsWith('.md')) continue;
    const body = frontmatter(fs.readFileSync(path.join(agentsDir, file), 'utf8'));
    if (!body) {
      fail(`agents/${file} has no frontmatter`);
      continue;
    }
    const keys = [];
    for (const line of body.split(/\r?\n/)) {
      if (line.trim() === '') continue;
      const match = /^([A-Za-z0-9_]+)\s*:/.exec(line);
      if (!match) {
        fail(`agents/${file} has a frontmatter line the strict schema would reject: ${line}`);
        continue;
      }
      keys.push(match[1]);
      if (!allowed.has(match[1])) fail(`agents/${file} key ${match[1]} is not in the local agent schema`);
    }
    const name = field(body, 'name');
    const description = field(body, 'description');
    if (!name || !/^[a-z0-9_-]+$/.test(name)) fail(`agents/${file} name is invalid`);
    if (!description) fail(`agents/${file} needs a description`);
    if (file === 'poteto-agent.md' && keys.includes('model')) {
      fail('poteto-agent.md must omit model so settings.json can override it');
    }
  }
}

function runWriter(home, budget) {
  return spawnSync(
    process.execPath,
    [path.join(root, 'scripts/write-pstack-models.mjs'), '--budget', budget],
    { env: { ...process.env, HOME: home }, encoding: 'utf8' },
  );
}

function checkWriter() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-models-'));
  const first = runWriter(home, 'large');
  if (first.status !== 0) fail(`writer large failed: ${first.stderr}`);
  const geminiMd = path.join(home, '.gemini/GEMINI.md');
  const settingsPath = path.join(home, '.gemini/settings.json');
  const md1 = fs.readFileSync(geminiMd, 'utf8');
  const settings1 = fs.readFileSync(settingsPath, 'utf8');
  if (!md1.includes('# budget: large (pro)')) fail('large block missing budget line');
  if (!md1.includes('swarm workers: flash')) fail('large block did not keep flash workers');
  if (!md1.includes('feature, refactoring: pro')) fail('large block missing feature role');
  const settings = JSON.parse(settings1);
  if (settings.model.name !== 'pro') fail('unset model.name should become pro');
  if (settings.agents.overrides['poteto-agent'].modelConfig.model !== 'pro') {
    fail('poteto-agent model should be pro on large');
  }
  const second = runWriter(home, 'large');
  if (second.status !== 0) fail(`writer re-run failed: ${second.stderr}`);
  if (fs.readFileSync(geminiMd, 'utf8') !== md1) fail('GEMINI.md changed on a second large run');
  if (fs.readFileSync(settingsPath, 'utf8') !== settings1) {
    fail('settings.json changed on a second large run');
  }

  const customHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-models-'));
  const geminiDir = path.join(customHome, '.gemini');
  fs.mkdirSync(geminiDir);
  fs.writeFileSync(
    path.join(geminiDir, 'settings.json'),
    `${JSON.stringify({ model: { name: 'flash', maxSessionTurns: 4 }, ui: { theme: 'dark' } }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(geminiDir, 'GEMINI.md'), 'keep this\n');
  const medium = runWriter(customHome, 'medium');
  if (medium.status !== 0) fail(`writer medium failed: ${medium.stderr}`);
  const kept = fs.readFileSync(path.join(geminiDir, 'GEMINI.md'), 'utf8');
  if (!kept.startsWith('keep this\n\n<!-- pstack-models:start -->')) {
    fail('writer did not keep existing GEMINI.md text');
  }
  if (!kept.includes('feature, refactoring: flash')) fail('medium did not lower pro to flash');
  if (!kept.includes('swarm workers: flash-lite')) fail('medium did not lower flash workers');
  const merged = JSON.parse(fs.readFileSync(path.join(geminiDir, 'settings.json'), 'utf8'));
  if (merged.model.name !== 'flash') fail('writer overwrote an existing model.name');
  if (merged.model.maxSessionTurns !== 4) fail('writer dropped model.maxSessionTurns');
  if (merged.ui.theme !== 'dark') fail('writer dropped unrelated settings');
  if (merged.agents.overrides['poteto-agent'].modelConfig.model !== 'flash') {
    fail('medium poteto-agent model should be flash');
  }

  const brokenHome = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-models-'));
  const brokenDir = path.join(brokenHome, '.gemini');
  fs.mkdirSync(brokenDir);
  fs.writeFileSync(path.join(brokenDir, 'settings.json'), '{');
  const broken = runWriter(brokenHome, 'small');
  if (broken.status === 0) fail('writer accepted invalid settings.json');
  if (fs.existsSync(path.join(brokenDir, 'GEMINI.md'))) {
    fail('writer wrote GEMINI.md after invalid settings.json');
  }
}

checkManifest();
checkCommands();
checkSkills();
checkAgents();
checkWriter();

if (failures.length > 0) {
  for (const message of failures) console.error(message);
  process.exit(1);
}
console.log('extension checks passed');
