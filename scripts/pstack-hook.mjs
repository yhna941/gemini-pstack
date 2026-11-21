#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function emit(value) {
  process.stdout.write(JSON.stringify(value));
}

function handle(input) {
  const event = input.hook_event_name || '';
  if (event === 'SessionStart') {
    emit({
      systemMessage:
        'pstack: run /poteto-mode. The adapter is docs/harness/gemini-cli.md. Nested work is scripts/delegate.mjs. A panel is scripts/panel.mjs.',
      suppressOutput: true,
    });
    return;
  }
  if (event === 'BeforeAgent') {
    emit({
      hookSpecificOutput: {
        additionalContext:
          'pstack adapter: docs/harness/gemini-cli.md. Nested subagent: node scripts/delegate.mjs. Panel: node scripts/panel.mjs. Loop: node scripts/loop.mjs.',
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
  if (started.status !== 0 || !startJson.systemMessage) {
    console.error('SessionStart hook failed');
    process.exit(1);
  }
  if (before.status !== 0 || !beforeJson.hookSpecificOutput?.additionalContext) {
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
