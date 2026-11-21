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
    /[Rr]ead playbooks\/[a-z0-9.-]+\.md from the activated poteto-mode skill directory,? and follow it\./g,
    'Follow the playbook text below. Do not read_file it.',
  );
  next = next.replace(
    /[Oo]pen skills\/poteto-mode\/playbooks\/[a-z0-9.-]+\.md/g,
    'follow the inlined playbook. Do not read_file it',
  );
  next = next.replace(
    /Activate poteto-mode and read references\/bugbot-triage\.md from that skill directory\./g,
    'The review script inlines the triage rubric. Do not read_file it.',
  );
  if (next.includes('poteto-mode') && !next.includes('activate_skill')) {
    next = next.replace(
      'Activate the poteto-mode skill',
      'Call activate_skill for poteto-mode when that tool is available. Do not read_file the skill path',
    );
  }
  if (
    (next.includes('poteto-mode') || next.includes('Activate the ')) &&
    !next.includes('If pstack lite is on')
  ) {
    next = next.replace(
      '\n{{args}}\n',
      '\nIf pstack lite is on, do the work in this chat and do not spawn subagents. For a bug fix or a feature, write a failing test first, run it, then the change, run the tests again, and commit. Batch reads with read_many_files. Avoid bursts of tiny tool calls.\n\n{{args}}\n',
    );
  }
  return next;
}

for (const name of fs.readdirSync(path.join(root, 'skills'))) {
  writeCommand(
    path.join(commandsDir, `${name}.toml`),
    `Run the ${name} skill.`,
    `${preamble} Call activate_skill for ${name} when that tool is available. Do not read_file the skill path. If pstack lite is on, do the work in this chat and do not spawn subagents. For a bug fix or a feature, write a failing test first, run it, then the change, run the tests again, and commit. Batch reads with read_many_files. Avoid bursts of tiny tool calls. The task is below. If it is empty, ask what to do.`,
  );
}

for (const file of fs.readdirSync(path.join(root, 'skills/poteto-mode/playbooks'))) {
  if (!file.endsWith('.md')) continue;
  const stem = file.slice(0, -3);
  writeCommand(
    path.join(commandsDir, `${stem}.toml`),
    `Run the ${stem} playbook.`,
    `${preamble} Call activate_skill for poteto-mode when that tool is available. Do not read_file the skill path. If pstack lite is on, do the work in this chat and do not spawn subagents. For a bug fix or a feature, write a failing test first, run it, then the change, run the tests again, and commit. Batch reads with read_many_files. Avoid bursts of tiny tool calls. Follow the playbook text below. Do not read_file it.\n\n<!-- playbook-inline -->\n${fs.readFileSync(path.join(root, 'skills/poteto-mode/playbooks', file), 'utf8')}\n\nThe task is below. If it is empty, ask what to do.`,
  );
}

for (const file of fs.readdirSync(commandsDir)) {
  if (!file.endsWith('.toml')) continue;
  const full = path.join(commandsDir, file);
  const current = fs.readFileSync(full, 'utf8');
  let rewritten = rewritePrompt(current);
  const stem = file.slice(0, -5);
  const play = path.join(root, 'skills/poteto-mode/playbooks', `${stem}.md`);
  if (fs.existsSync(play) && !rewritten.includes('<!-- playbook-inline -->')) {
    const body = fs.readFileSync(play, 'utf8');
    rewritten = rewritten.replace(
      '\n{{args}}\n',
      `\n<!-- playbook-inline -->\n${body}\n\n{{args}}\n`,
    );
  }
  if (rewritten !== current) fs.writeFileSync(full, rewritten);
}

console.log(`commands ${fs.readdirSync(commandsDir).length}`);
