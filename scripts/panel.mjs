#!/usr/bin/env node
import {
  panelModels,
  plan,
  readPrompt,
  resolveModel,
  runPlans,
  selfTestPlan,
  selfTestResolve,
} from './gemini-run.mjs';

if (process.argv.includes('--self-test')) {
  selfTestResolve();
  selfTestPlan('panel', panelModels('pro'));
} else {
  const prompt = readPrompt(process.argv);
  if (!prompt) {
    console.error('Usage: node scripts/panel.mjs [--model <name>] [--dry-run] -- <prompt>');
    process.exit(1);
  }
  const seats = panelModels(resolveModel(process.argv));
  process.exit(runPlans(plan(seats, prompt), process.argv.includes('--dry-run')));
}
