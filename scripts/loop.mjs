#!/usr/bin/env node
import {
  plan,
  readPrompt,
  resolveModel,
  runPlans,
  selfTestPlan,
  selfTestResolve,
} from './gemini-run.mjs';

function times() {
  const index = process.argv.indexOf('--times');
  const end = process.argv.indexOf('--');
  if (index !== -1 && end !== -1 && index > end) {
    console.error('--times must come before --');
    process.exit(1);
  }
  const value = index === -1 ? 2 : Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    console.error('--times must be an integer from 1 to 20');
    process.exit(1);
  }
  return value;
}

if (process.argv.includes('--self-test')) {
  selfTestResolve();
  selfTestPlan('loop', ['pro', 'pro']);
} else {
  const prompt = readPrompt(process.argv);
  if (!prompt) {
    console.error('Usage: node scripts/loop.mjs [--model <name>] [--times 2] [--dry-run] -- <prompt>');
    process.exit(1);
  }
  const model = resolveModel(process.argv);
  const count = times();
  process.exit(
    runPlans(
      plan(Array.from({ length: count }, () => model), prompt),
      process.argv.includes('--dry-run'),
    ),
  );
}
