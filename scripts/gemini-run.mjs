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

export function paceMs(argv = process.argv, env = process.env) {
  const flagged = flagValue(argv, '--pace');
  if (flagged) return Number(flagged);
  if (typeof env.PSTACK_MIN_INTERVAL_MS === 'string' && env.PSTACK_MIN_INTERVAL_MS.trim()) {
    return Number(env.PSTACK_MIN_INTERVAL_MS);
  }
  return 0;
}

export function retryWaitMs(text) {
  if (!text) return 0;
  const match = text.match(/retryDelay["']?\s*[:=]\s*"?(\d+(?:\.\d+)?)(ms|s)?"?/i);
  if (match) {
    const value = Number(match[1]);
    if (match[2] === 'ms') return Math.ceil(value);
    if (match[2] === 's' || value < 1000) return Math.ceil(value * 1000);
    return Math.ceil(value);
  }
  if (/429|RESOURCE_EXHAUSTED|quota/i.test(text)) return 60000;
  return 0;
}

function sleepMs(ms) {
  if (ms <= 0) return;
  spawnSync('sleep', [(ms / 1000).toFixed(3)]);
}

export function runPlans(plans, dryRun, intervalMs = 0) {
  if (dryRun) {
    for (const step of plans) {
      console.log(`${step.command} ${step.args.slice(0, -1).join(' ')} <prompt>`);
    }
    if (intervalMs > 0) console.log(`pace ${intervalMs}ms`);
    return 0;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Skipped: GEMINI_API_KEY is not set.');
    return 0;
  }
  for (let index = 0; index < plans.length; index += 1) {
    if (index > 0) sleepMs(intervalMs);
    const step = plans[index];
    let attempt = 0;
    while (true) {
      const result = spawnSync(step.command, step.args, { encoding: 'utf8' });
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      if ((result.status ?? 1) === 0) break;
      const wait = retryWaitMs(`${result.stderr || ''}\n${result.stdout || ''}`);
      if (wait > 0 && attempt < 2) {
        attempt += 1;
        console.error(`Rate limited. Waiting ${wait}ms before retry ${attempt}.`);
        sleepMs(wait);
        continue;
      }
      return result.status ?? 1;
    }
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
  if (paceMs(['node', 'loop.mjs', '--pace', '1500'], { PSTACK_MIN_INTERVAL_MS: '50' }) !== 1500) {
    console.error('--pace should beat PSTACK_MIN_INTERVAL_MS');
    process.exit(1);
  }
  if (paceMs(['node', 'loop.mjs'], { PSTACK_MIN_INTERVAL_MS: '2000' }) !== 2000) {
    console.error('PSTACK_MIN_INTERVAL_MS should set the interval');
    process.exit(1);
  }
  if (retryWaitMs('RESOURCE_EXHAUSTED retryDelay: "47s"') !== 47000) {
    console.error('retryDelay seconds should become milliseconds');
    process.exit(1);
  }
  if (retryWaitMs('HTTP 429') !== 60000) {
    console.error('a 429 without retryDelay should wait 60s');
    process.exit(1);
  }
  if (retryWaitMs('ok') !== 0) {
    console.error('a normal response should not wait');
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
