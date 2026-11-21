#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

export function readPrompt(argv) {
  const split = argv.indexOf('--');
  const words = split === -1 ? [] : argv.slice(split + 1);
  return words.join(' ').trim();
}

export function plan(models, prompt) {
  return models.map((model) => ({
    command: 'gemini',
    args: ['-m', model, '-p', prompt],
  }));
}

export function runPlans(plans, dryRun) {
  if (dryRun) {
    for (const step of plans) {
      console.log(`${step.command} ${step.args.slice(0, -1).join(' ')} <prompt>`);
    }
    return 0;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Skipped: GEMINI_API_KEY is not set.');
    return 0;
  }
  for (const step of plans) {
    const result = spawnSync(step.command, step.args, { stdio: 'inherit' });
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

export function selfTestPlan(label, models) {
  const plans = plan(models, 'ping');
  if (plans.length !== models.length) {
    console.error(`${label} plan length`);
    process.exit(1);
  }
  for (let i = 0; i < models.length; i += 1) {
    if (plans[i].args[1] !== models[i] || plans[i].args[2] !== '-p' || plans[i].args[3] !== 'ping') {
      console.error(`${label} plan shape`);
      process.exit(1);
    }
  }
  console.log(`${label} self-test passed`);
}
