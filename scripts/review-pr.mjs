#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { plan, runPlans } from './gemini-run.mjs';

const prompt = [
  'Review the pull request diff below.',
  'Classify each finding with skills/poteto-mode/references/bugbot-triage.md.',
  'Report only findings you can point at in the diff.',
  'Diff:',
  spawnSync('git', ['diff', '--stat'], { encoding: 'utf8' }).stdout || '(no diff)',
].join('\n');

if (process.argv.includes('--self-test')) {
  const steps = plan(['pro'], 'ping');
  if (steps[0].args[1] !== 'pro') process.exit(1);
  if (!prompt.includes('bugbot-triage.md')) process.exit(1);
  console.log('review-pr self-test passed');
} else if (process.argv.includes('--dry-run')) {
  console.log('gemini -m pro -p <review prompt>');
  console.log(`prompt bytes ${Buffer.byteLength(prompt)}`);
} else {
  process.exit(runPlans(plan(['pro'], prompt), false));
}
