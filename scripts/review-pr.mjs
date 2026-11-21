#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, resolveModel, runPlans, selfTestResolve } from './gemini-run.mjs';

const rubricPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'skills',
  'poteto-mode',
  'references',
  'bugbot-triage.md',
);

export function loadRubric() {
  return fs.readFileSync(rubricPath, 'utf8');
}

export function reviewArgs(model, prompt) {
  return ['-m', model, '--approval-mode', 'plan', '-p', prompt];
}

export function buildReviewPrompt(diff, rubric = loadRubric()) {
  return [
    'Review only. The diff is inlined below.',
    'Do not edit files. Do not run tests or commands. Reply with findings, then stop.',
    'The triage rubric is inlined. Do not read_file any path, including paths named inside the rubric.',
    rubric,
    'Diff:',
    diff,
  ].join('\n');
}

if (process.argv.includes('--self-test')) {
  selfTestResolve();
  const sample = buildReviewPrompt('(no diff)', 'Decision rubric\n- fix\n- dismiss\n- ask\n');
  if (!sample.includes('Decision rubric') || !sample.includes('Do not read_file')) process.exit(1);
  if (!sample.includes('Do not edit files') || !sample.includes('Do not run tests or commands')) {
    process.exit(1);
  }
  if (sample.includes('skills/poteto-mode/references/bugbot-triage.md')) process.exit(1);
  const real = buildReviewPrompt('(no diff)');
  if (!real.includes('Classify each Bugbot thread')) process.exit(1);
  if (real.includes('skills/poteto-mode/references/bugbot-triage.md')) process.exit(1);
  const steps = plan(['gemini-2.5-flash'], 'ping');
  if (steps[0].args[1] !== 'gemini-2.5-flash') process.exit(1);
  const args = reviewArgs('gemini-3.5-flash-lite', sample);
  if (!args.includes('--approval-mode') || !args.includes('plan')) process.exit(1);
  if (args.includes('yolo') || args.includes('write_file')) process.exit(1);
  console.log('review-pr self-test passed');
} else if (process.argv.includes('--dry-run')) {
  const model = resolveModel(process.argv);
  const prompt = buildReviewPrompt(
    spawnSync('git', ['diff', '--stat'], { encoding: 'utf8' }).stdout || '(no diff)',
  );
  console.log(`gemini ${reviewArgs(model, prompt).slice(0, -1).join(' ')} <review prompt>`);
  console.log(`prompt bytes ${Buffer.byteLength(prompt)}`);
} else {
  const model = resolveModel(process.argv);
  const prompt = buildReviewPrompt(
    spawnSync('git', ['diff', '--stat'], { encoding: 'utf8' }).stdout || '(no diff)',
  );
  process.exit(
    runPlans([{ command: 'gemini', args: reviewArgs(model, prompt) }], false),
  );
}
