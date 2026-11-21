#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { plan, resolveModel, runPlans, selfTestResolve } from './gemini-run.mjs';

const prompt = [
  'Review the pull request diff below.',
  'Classify each finding with the bugbot triage rubric that the pstack extension injected, or skills/poteto-mode/references/bugbot-triage.md inside the activated poteto-mode skill directory.',
  'Report only findings you can point at in the diff.',
  'Diff:',
  spawnSync('git', ['diff', '--stat'], { encoding: 'utf8' }).stdout || '(no diff)',
].join('\n');

if (process.argv.includes('--self-test')) {
  selfTestResolve();
  const steps = plan(['gemini-2.5-flash'], 'ping');
  if (steps[0].args[1] !== 'gemini-2.5-flash') process.exit(1);
  if (!prompt.includes('bugbot-triage.md')) process.exit(1);
  console.log('review-pr self-test passed');
} else if (process.argv.includes('--dry-run')) {
  const model = resolveModel(process.argv);
  console.log(`gemini -m ${model} -p <review prompt>`);
  console.log(`prompt bytes ${Buffer.byteLength(prompt)}`);
} else {
  process.exit(runPlans(plan([resolveModel(process.argv)], prompt), false));
}
