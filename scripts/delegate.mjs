#!/usr/bin/env node
import {
  plan,
  readPrompt,
  resolveModel,
  runPlans,
  selfTestPlan,
  selfTestResolve,
} from './gemini-run.mjs';

if (process.argv.includes('--self-test')) {
  selfTestResolve();
  selfTestPlan('delegate', ['pro']);
} else {
  const prompt = readPrompt(process.argv);
  const model = resolveModel(process.argv);
  if (!prompt || !model) {
    console.error('Usage: node scripts/delegate.mjs [--model <name>] [--dry-run] -- <prompt>');
    process.exit(1);
  }
  process.exit(runPlans(plan([model], prompt), process.argv.includes('--dry-run')));
}
