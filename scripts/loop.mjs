#!/usr/bin/env node
import { plan, readPrompt, runPlans, selfTestPlan } from './gemini-run.mjs';

function times() {
  const index = process.argv.indexOf('--times');
  const value = index === -1 ? 2 : Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    console.error('--times must be an integer from 1 to 20');
    process.exit(1);
  }
  return value;
}

if (process.argv.includes('--self-test')) {
  selfTestPlan('loop', Array.from({ length: 2 }, () => 'pro'));
} else {
  const prompt = readPrompt(process.argv);
  if (!prompt) {
    console.error('Usage: node scripts/loop.mjs [--times 2] [--dry-run] -- <prompt>');
    process.exit(1);
  }
  const count = times();
  process.exit(
    runPlans(
      plan(Array.from({ length: count }, () => 'pro'), prompt),
      process.argv.includes('--dry-run'),
    ),
  );
}
