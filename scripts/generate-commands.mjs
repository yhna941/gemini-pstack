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
  'The SessionStart hook already injected the pstack adapter text and the absolute extension root. Follow that injected text. The adapter wins when a Cursor name and a Gemini name differ. Do not read a workspace-relative docs/harness/gemini-cli.md. Run scripts from <extension root>/scripts using that absolute path.';

const replacements = [
  [
    'Read docs/harness/gemini-cli.md from the pstack extension once this session. The adapter wins when a Cursor name and a Gemini name differ.',
    preamble,
  ],
  [
    'Read docs/harness/gemini-cli.md from the pstack extension once this session',
    preamble,
  ],
  ['Read docs/harness/gemini-cli.md once this session.', preamble],
];

function rewritePrompt(text) {
  let next = text;
  for (const [from, to] of replacements) next = next.replaceAll(from, to);
  next = next.replace(
    /[Oo]pen skills\/poteto-mode\/playbooks\/([a-z0-9.-]+\.md)/g,
    'read playbooks/$1 from the activated poteto-mode skill directory',
  );
  return next;
}

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
    `${preamble} Activate the poteto-mode skill. Read playbooks/${file} from the activated poteto-mode skill directory and follow it. The task is below. If it is empty, ask what to do.`,
  );
}

for (const file of fs.readdirSync(commandsDir)) {
  if (!file.endsWith('.toml')) continue;
  const full = path.join(commandsDir, file);
  const current = fs.readFileSync(full, 'utf8');
  const rewritten = rewritePrompt(current);
  if (rewritten !== current) fs.writeFileSync(full, rewritten);
}

console.log(`commands ${fs.readdirSync(commandsDir).length}`);
