#!/usr/bin/env node
import { plan, readPrompt, runPlans, selfTestPlan } from './gemini-run.mjs';

function model() {
  const index = process.argv.indexOf('--model');
  return index === -1 ? 'pro' : process.argv[index + 1];
}

if (process.argv.includes('--self-test')) {
  selfTestPlan('delegate', [model() === 'pro' && process.argv.includes('--model') ? 'flash' : 'pro']);
  const flash = plan(['flash'], 'ping');
  if (flash[0].args[1] !== 'flash') process.exit(1);
} else {
  const prompt = readPrompt(process.argv);
  if (!prompt || !model()) {
    console.error('Usage: node scripts/delegate.mjs [--model pro] [--dry-run] -- <prompt>');
    process.exit(1);
  }
  process.exit(runPlans(plan([model()], prompt), process.argv.includes('--dry-run')));
}
