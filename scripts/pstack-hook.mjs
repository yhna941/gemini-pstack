#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export function liteEnabled(env = process.env, home = os.homedir()) {
  const flag = env.PSTACK_LITE;
  if (flag === '1' || flag === 'true') return true;
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(home, '.gemini', 'settings.json'), 'utf8'),
    );
    return parsed?.pstack?.lite === true;
  } catch {
    return false;
  }
}

export function contextBlock(lite = liteEnabled()) {
  const bundle = adapterBundle();
  const paths = [
    `pstack extension root: ${bundle.root}`,
    `pstack skills directory: ${bundle.skillsDir}`,
    'Do not read_file any path under the extension root. Activate a skill by name. Its SKILL.md body is injected. Slash commands include their playbook text.',
    'If hooks are off, start Gemini with --include-directories set to the extension root.',
  ];
  if (lite) {
    return [
      'LITE MODE.',
      ...paths,
      'Do this work in the current chat. Do not spawn poteto-agent, generalist, comment-sicko, or any other subagent. Do not run scripts/delegate.mjs.',
      'A bug fix or feature still writes a failing test first, runs it, then the fix, then runs the tests again, then commits. Prove the result by running the test or the real command. A compile is not the proof.',
      `Model default for this mode is gemini-3.5-flash-lite. Free tier input limit is 250000 tokens per minute.`,
    ].join('\n');
  }
  return [
    ...paths,
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
  const lite = liteEnabled();
  const block = contextBlock(lite);
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
        additionalContext: lite
          ? 'LITE MODE. Stay in this chat. Do not spawn subagents. Keep the failing test first, the rerun, and the commit.'
          : [
              `pstack extension root: ${root}`,
              'Do not read_file paths under that root. The adapter text was injected at session start.',
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
  const env = { ...process.env, PSTACK_LITE: '' };
  const started = spawnSync(process.execPath, [self], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
    env,
  });
  const before = spawnSync(process.execPath, [self], {
    input: JSON.stringify({ hook_event_name: 'BeforeAgent', prompt: '/poteto-mode' }),
    encoding: 'utf8',
    env,
  });
  const lite = spawnSync(process.execPath, [self], {
    input: JSON.stringify({ hook_event_name: 'SessionStart' }),
    encoding: 'utf8',
    env: { ...process.env, PSTACK_LITE: '1' },
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
  if (before.status !== 0 || !beforeContext.includes(root) || beforeContext.includes('read_file paths under') === false) {
    console.error('BeforeAgent hook failed');
    process.exit(1);
  }
  const liteJson = JSON.parse(lite.stdout);
  const liteText = liteJson.hookSpecificOutput?.additionalContext || '';
  if (!liteText.includes('LITE MODE') || liteText.includes('# pstack in Gemini CLI')) {
    console.error('lite SessionStart should be the compact adapter');
    process.exit(1);
  }
  if (liteText.length >= injected.length) {
    console.error('lite context should be smaller than the full adapter');
    process.exit(1);
  }
  if (started.stdout.includes('\n') || before.stdout.includes('\n') || lite.stdout.includes('\n')) {
    console.error('hook stdout must be one JSON value');
    process.exit(1);
  }
  console.log('pstack-hook self-test passed');
}

const isMain =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain && process.argv.includes('--self-test')) {
  selfTest();
} else if (isMain) {
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
