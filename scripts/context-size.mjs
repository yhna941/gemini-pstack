#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextBlock } from './pstack-hook.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function tokens(text) {
  return Math.ceil(text.length / 4);
}

function catalog() {
  const lines = [];
  for (const dir of fs.readdirSync(path.join(root, 'skills'))) {
    const file = path.join(root, 'skills', dir, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const front = match ? match[1] : '';
    const name = (front.match(/^name:\s*(.*)$/m) || [])[1] || dir;
    const description = (front.match(/^description:\s*(.*)$/m) || [])[1] || '';
    lines.push(`${name}: ${description}`);
  }
  return lines.join('\n');
}

const gemini = fs.readFileSync(path.join(root, 'GEMINI.md'), 'utf8');
const names = catalog();
const full = contextBlock(false);
const lite = contextBlock(true);

function line(label, text) {
  console.log(`${label} chars ${text.length} est_tokens ${tokens(text)}`);
}

line('GEMINI.md', gemini);
line('skill name+description catalog', names);
line('full SessionStart context', full);
line('lite SessionStart context', lite);
const before = gemini.length + names.length + full.length;
const after = gemini.length + names.length + lite.length;
console.log(`before chars ${before} est_tokens ${tokens(gemini) + tokens(names) + tokens(full)}`);
console.log(`after chars ${after} est_tokens ${tokens(gemini) + tokens(names) + tokens(lite)}`);
console.log(
  'estimate is chars/4. Gemini CLI also sends tool schemas. This count is the extension text we add on top of that.',
);
