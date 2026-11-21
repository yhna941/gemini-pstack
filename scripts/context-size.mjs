#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextBlock } from './pstack-hook.mjs';
import { LITE_SKILLS } from './write-pstack-models.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tokens(text) {
  return Math.ceil(text.length / 4);
}

function catalog(only) {
  const lines = [];
  for (const dir of fs.readdirSync(path.join(root, 'skills'))) {
    const file = path.join(root, 'skills', dir, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const front = match ? match[1] : '';
    const name = ((front.match(/^name:\s*(.*)$/m) || [])[1] || dir).trim();
    if (only && !only.has(name)) continue;
    const description = (front.match(/^description:\s*(.*)$/m) || [])[1] || '';
    lines.push(`${name}: ${description}`);
  }
  return lines.join('\n');
}

function toolDocs(dir) {
  if (!dir || !fs.existsSync(dir)) return null;
  const liteNames = new Set(['file-system.md', 'shell.md', 'activate-skill.md']);
  let full = '';
  let lite = '';
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith('.md')) continue;
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    full += text;
    if (liteNames.has(name)) lite += text;
  }
  return { full, lite, dir };
}

const gemini = fs.readFileSync(path.join(root, 'GEMINI.md'), 'utf8');
const names = catalog();
const liteNames = catalog(new Set(LITE_SKILLS));
const full = contextBlock(false);
const lite = contextBlock(true);
const toolDir =
  process.env.GEMINI_TOOL_DOCS ||
  '/home/ubuntu/.local/node_modules/@google/gemini-cli/bundle/docs/tools';
const tools = toolDocs(toolDir);

function line(label, text) {
  console.log(`${label} chars ${text.length} est_tokens ${tokens(text)}`);
}

line('GEMINI.md', gemini);
line('full skill catalog', names);
line('lite skill catalog', liteNames);
line('full SessionStart context', full);
line('lite SessionStart context', lite);
if (tools) {
  line('tool docs proxy full', tools.full);
  line('tool docs proxy lite', tools.lite);
  console.log(`tool docs dir ${tools.dir}`);
} else {
  console.log('tool docs proxy unavailable');
}
const before =
  tokens(gemini) + tokens(names) + tokens(full) + (tools ? tokens(tools.full) : 0);
const after =
  tokens(gemini) + tokens(liteNames) + tokens(lite) + (tools ? tokens(tools.lite) : 0);
console.log(`before est_tokens ${before}`);
console.log(`after est_tokens ${after}`);
console.log(
  'estimate is chars/4. Tool docs are a proxy for schema size, not the bytes on the wire. No API key was required.',
);
