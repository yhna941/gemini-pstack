#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsDir = path.join(root, 'skills');
const adapterPath = path.join(root, 'docs', 'harness', 'gemini-cli.md');

export function adapterBundle() {
  let text = '';
  try {
    text = fs.readFileSync(adapterPath, 'utf8');
  } catch {
    text = 'Adapter file missing.';
  }
  return { root, skillsDir, adapterPath, text };
}

export function contextBlock() {
  const bundle = adapterBundle();
  return [
    `pstack extension root: ${bundle.root}`,
    `pstack skills directory: ${bundle.skillsDir}`,
    `pstack adapter file: ${bundle.adapterPath}`,
    'This text is already in the session. Do not read a workspace-relative docs/harness/gemini-cli.md. read_file cannot see the extension from another project unless the user passed --include-directories.',
    'Run scripts as node <extension root>/scripts/<name>.mjs.',
    '',
    bundle.text,
  ].join('\n');
}

function emit(value) {
  process.stdout.write(JSON.stringify(value));
}

function handle(input) {
  const event = input.hook_event_name || '';
  const block = contextBlock();
  if (event === 'SessionStart') {
    emit({
      systemMessage: `pstack extension root: ${root}`,
      hookSpecificOutput: { additionalContext: block },
      suppressOutput: true,
    });
    return;
  }
  if (event === 'BeforeAgent') {
    emit({
      hookSpecificOutput: {
        additionalContext: [
          `pstack extension root: ${root}`,
          `pstack skills directory: ${skillsDir}`,
          `pstack adapter file: ${adapterPath}`,
          'The adapter text was injected at session start. Do not read a workspace-relative docs/harness/gemini-cli.md.',
          `Nested work: node ${path.join(root, 'scripts', 'delegate.mjs')}`,
          `Panel: node ${path.join(root, 'scripts', 'panel.mjs')}`,
          `Loop: node ${path.join(root, 'scripts', 'loop.mjs')}`,
        ].join('\n'),
      },
      suppressOutput: true,
    });
    return;
  }
  emit({ suppressOutput: true });
}

function selfTest() {
  const self = fileURLToPath(import.meta.url);
  const started = spawnSync(process.execPath, [self], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
  });
  const before = spawnSync(process.execPath, [self], {
    input: JSON.stringify({ hook_event_name: 'BeforeAgent', prompt: '/poteto-mode' }),
    encoding: 'utf8',
  });
  const startJson = JSON.parse(started.stdout);
  const beforeJson = JSON.parse(before.stdout);
  const injected = startJson.hookSpecificOutput?.additionalContext || '';
  if (started.status !== 0 || !startJson.systemMessage?.includes(root)) {
    console.error('SessionStart hook failed');
    process.exit(1);
  }
  if (!injected.includes(root) || !injected.includes(skillsDir) || !injected.includes('pstack in Gemini CLI')) {
    console.error('SessionStart did not inject the adapter text and absolute paths');
    process.exit(1);
  }
  const beforeContext = beforeJson.hookSpecificOutput?.additionalContext || '';
  if (before.status !== 0 || !beforeContext.includes(adapterPath)) {
    console.error('BeforeAgent hook failed');
    process.exit(1);
  }
  if (started.stdout.includes('\n') || before.stdout.includes('\n')) {
    console.error('hook stdout must be one JSON value');
    process.exit(1);
  }
  console.log('pstack-hook self-test passed');
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    let input = {};
    if (raw.trim()) {
      try {
        input = JSON.parse(raw);
      } catch {
        input = {};
      }
    }
    handle(input);
  });
}
