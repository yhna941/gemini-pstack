#!/usr/bin/env node
import { plan, readPrompt, runPlans, selfTestPlan } from './gemini-run.mjs';

const models = ['pro', 'flash'];

if (process.argv.includes('--self-test')) {
  selfTestPlan('panel', models);
} else {
  const prompt = readPrompt(process.argv);
  if (!prompt) {
    console.error('Usage: node scripts/panel.mjs [--dry-run] -- <prompt>');
    process.exit(1);
  }
  process.exit(runPlans(plan(models, prompt), process.argv.includes('--dry-run')));
}
