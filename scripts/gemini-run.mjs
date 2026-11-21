#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function readPrompt(argv) {
  const split = argv.indexOf('--');
  const words = split === -1 ? [] : argv.slice(split + 1);
  return words.join(' ').trim();
}

function flagValue(argv, flag) {
  const end = argv.indexOf('--');
  const limit = end === -1 ? argv.length : end;
  const index = argv.lastIndexOf(flag, limit - 1);
  if (index === -1 || index + 1 >= limit) return '';
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) return '';
  return value.trim();
}

export function readSettingsModel(home) {
  const settingsPath = path.join(home, '.gemini', 'settings.json');
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const name = parsed?.model?.name;
    if (typeof name === 'string' && name.trim()) return name.trim();
  } catch {
    return '';
  }
  return '';
}

export function resolveModel(argv, env = process.env, home = os.homedir()) {
  const flagged = flagValue(argv, '--model');
  if (flagged) return flagged;
  const fromEnv = env.PSTACK_MODEL;
  if (typeof fromEnv === 'string' && fromEnv.trim()) return fromEnv.trim();
  const fromSettings = readSettingsModel(home);
  if (fromSettings) return fromSettings;
  return 'pro';
}

export function panelModels(primary) {
  if (primary === 'pro') return ['pro', 'flash'];
  if (primary === 'flash') return ['flash', 'flash-lite'];
  return [primary, primary];
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

export function selfTestResolve() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-model-'));
  const geminiDir = path.join(home, '.gemini');
  fs.mkdirSync(geminiDir);
  fs.writeFileSync(
    path.join(geminiDir, 'settings.json'),
    `${JSON.stringify({ model: { name: 'flash' }, ui: { theme: 'dark' } })}\n`,
  );
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pstack-model-empty-'));
  if (resolveModel([], {}, empty) !== 'pro') {
    console.error('missing settings should fall back to pro');
    process.exit(1);
  }
  if (resolveModel([], {}, home) !== 'flash') {
    console.error('settings model.name should win');
    process.exit(1);
  }
  if (resolveModel([], { PSTACK_MODEL: 'gemini-2.5-flash' }, home) !== 'gemini-2.5-flash') {
    console.error('PSTACK_MODEL should beat settings');
    process.exit(1);
  }
  if (
    resolveModel(['node', 'panel.mjs', '--model', 'flash-lite', '--dry-run'], {
      PSTACK_MODEL: 'flash',
    }, home) !== 'flash-lite'
  ) {
    console.error('--model should beat PSTACK_MODEL');
    process.exit(1);
  }
  if (
    resolveModel(['node', 'panel.mjs', '--dry-run', '--', '--model', 'nope'], {}, home) !== 'flash'
  ) {
    console.error('a --model after -- is prompt text, not a flag');
    process.exit(1);
  }
  fs.writeFileSync(path.join(geminiDir, 'settings.json'), '{');
  if (resolveModel([], {}, home) !== 'pro') {
    console.error('invalid settings.json should fall back to pro');
    process.exit(1);
  }
  const seats = panelModels('pro');
  if (seats[0] !== 'pro' || seats[1] !== 'flash') {
    console.error('pro panel should be pro then flash');
    process.exit(1);
  }
  const flashSeats = panelModels('flash');
  if (flashSeats[0] !== 'flash' || flashSeats[1] !== 'flash-lite') {
    console.error('flash panel should step down');
    process.exit(1);
  }
  const custom = panelModels('gemini-2.5-flash');
  if (custom[0] !== 'gemini-2.5-flash' || custom[1] !== 'gemini-2.5-flash') {
    console.error('a concrete model should be used for both panel seats');
    process.exit(1);
  }
  console.log('model resolution self-test passed');
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url &&
  process.argv.includes('--self-test')
) {
  selfTestResolve();
}
