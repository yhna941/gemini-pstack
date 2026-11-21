#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commandsDir = path.join(root, 'commands');
const keep = new Set([
  'poteto-mode.toml',
  'setup-pstack.toml',
  'investigation.toml',
  'bug-fix.toml',
  'feature.toml',
  'verification.toml',
]);

function writeCommand(file, description, body) {
  if (keep.has(path.basename(file)) && fs.existsSync(file)) return;
  const text = `description = "${description}"\nprompt = """\n${body.trim()}\n\n{{args}}\n"""\n`;
  fs.writeFileSync(file, text);
}

const preamble =
  'Read docs/harness/gemini-cli.md from the pstack extension once this session. The adapter wins when a Cursor name and a Gemini name differ.';

for (const name of fs.readdirSync(path.join(root, 'skills'))) {
  writeCommand(
    path.join(commandsDir, `${name}.toml`),
    `Run the ${name} skill.`,
    `${preamble} Activate the ${name} skill and follow it. The task is below. If it is empty, ask what to do.`,
  );
}

for (const file of fs.readdirSync(path.join(root, 'skills/poteto-mode/playbooks'))) {
  if (!file.endsWith('.md')) continue;
  const stem = file.slice(0, -3);
  writeCommand(
    path.join(commandsDir, `${stem}.toml`),
    `Run the ${stem} playbook.`,
    `${preamble} Activate the poteto-mode skill. Open skills/poteto-mode/playbooks/${file} and follow it. The task is below. If it is empty, ask what to do.`,
  );
}

console.log(`commands ${fs.readdirSync(commandsDir).length}`);
