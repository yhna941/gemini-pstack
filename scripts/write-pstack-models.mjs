#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const BUDGETS = new Set(['large', 'medium', 'small', 'lite']);
const LITE_MODEL = 'gemini-3.5-flash-lite';
export const LITE_SKILLS = [
  'poteto-mode',
  'tdd',
  'principle-prove-it-works',
  'setup-pstack',
];
export const LITE_TOOLS = [
  'read_file',
  'read_many_files',
  'glob',
  'grep_search',
  'list_directory',
  'write_file',
  'replace',
  'run_shell_command',
  'activate_skill',
];

function skillNames() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'skills');
  return fs
    .readdirSync(dir)
    .filter((name) => fs.existsSync(path.join(dir, name, 'SKILL.md')))
    .sort();
}
const LADDER = ['pro', 'flash', 'flash-lite'];
const STEPS = { large: 0, medium: 1, small: 2 };
const PARENT = { large: 'pro', medium: 'flash', small: 'flash-lite' };
const ROLES = [
  ['feature, refactoring', 'pro'],
  ['bug-fix', 'pro'],
  ['perf-issue', 'pro'],
  ['hillclimb', 'pro'],
  ['judgment and prose', 'pro'],
  ['arena runners', 'pro'],
  ['arena cross-judge pool', 'pro'],
  ['swarm workers', 'flash'],
  ['interrogate reviewers', 'pro'],
];
const START = '<!-- pstack-models:start -->';
const END = '<!-- pstack-models:end -->';

function lower(alias, steps) {
  const index = LADDER.indexOf(alias);
  if (index < 0) return alias;
  return LADDER[Math.min(LADDER.length - 1, index + steps)];
}

function roleBlock(budget) {
  if (budget === 'lite') {
    const lines = ROLES.map(([role]) => `${role}: ${LITE_MODEL}`);
    return [
      '# pstack model configuration. One line per role. Delete a line to fall back to the skill default.',
      '# `inherit` omits the subagent model field so the role uses the parent model.',
      '# `auto`, `pro`, `flash`, and `flash-lite` are Gemini CLI aliases.',
      '# Gemini CLI has one vendor. A panel line with one alias is one pass.',
      '# lite keeps the parent chat on one model and does not spawn subagents.',
      '# defaults: 3',
      `# budget: lite (${LITE_MODEL})`,
      ...lines,
      '',
    ].join('\n');
  }
  const steps = STEPS[budget];
  const lines = ROLES.map(([role, alias]) => `${role}: ${lower(alias, steps)}`);
  return [
    '# pstack model configuration. One line per role. Delete a line to fall back to the skill default.',
    '# `inherit` omits the subagent model field so the role uses the parent model.',
    '# `auto`, `pro`, `flash`, and `flash-lite` are Gemini CLI aliases.',
    '# Gemini CLI has one vendor. A panel line with one alias is one pass.',
    '# defaults: 3',
    `# budget: ${budget} (${PARENT[budget]})`,
    ...lines,
    '',
  ].join('\n');
}

function parseArgs(argv) {
  let budget = null;
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--budget') {
      budget = argv[++i];
      if (!budget) throw new Error('Missing value for --budget');
    } else if (arg === '--help' || arg === '-h') {
      return { help: true, budget: null };
    } else {
      throw new Error(`Unknown argument ${arg}`);
    }
  }
  return { help: false, budget };
}

function wrapped(block) {
  return `${START}\n${block}${END}\n`;
}

function upsertGeminiMd(file, block) {
  const next = wrapped(block);
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, next);
    return;
  }
  const text = fs.readFileSync(file, 'utf8');
  const hasStart = text.includes(START);
  const hasEnd = text.includes(END);
  if (hasStart !== hasEnd) {
    throw new Error(
      `${file} has only one pstack-models marker. Refusing to edit it.`,
    );
  }
  if (!hasStart) {
    const prefix =
      text.length === 0 ? '' : text + (text.endsWith('\n') ? '\n' : '\n\n');
    fs.writeFileSync(file, `${prefix}${next}`);
    return;
  }
  const pattern = new RegExp(
    `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n?`,
  );
  if (!pattern.test(text)) {
    throw new Error(`${file} has pstack-models markers this script cannot replace.`);
  }
  fs.writeFileSync(file, text.replace(pattern, next));
}

function objectOrEmpty(value, label) {
  if (value === undefined) return {};
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value;
}

function loadSettings(file) {
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, 'utf8');
  if (text.trim() === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`${file} is not valid JSON. ${err.message}`);
  }
  return objectOrEmpty(parsed, file);
}

function applyLite(settings) {
  if (!settings.pstack.liteBackup) {
    settings.pstack.liteBackup = {
      skillsDisabled: Array.isArray(settings.skills?.disabled) ? [...settings.skills.disabled] : [],
      tools: settings.tools === undefined ? null : structuredClone(settings.tools),
      maxAttempts: settings.general?.maxAttempts ?? null,
      modelRouting: settings.general?.plan?.modelRouting ?? null,
      modelName: settings.model?.name ?? null,
    };
  }
  const skills = objectOrEmpty(settings.skills, 'skills');
  const keep = new Set(LITE_SKILLS);
  skills.disabled = skillNames().filter((name) => !keep.has(name));
  settings.skills = skills;
  const tools = objectOrEmpty(settings.tools, 'tools');
  tools.core = [...LITE_TOOLS];
  settings.tools = tools;
  const general = objectOrEmpty(settings.general, 'general');
  general.maxAttempts = 2;
  const plan = objectOrEmpty(general.plan, 'general.plan');
  plan.modelRouting = false;
  general.plan = plan;
  settings.general = general;
}

function revertLite(settings) {
  const backup = settings.pstack.liteBackup;
  if (!backup) return;
  const skills = objectOrEmpty(settings.skills, 'skills');
  skills.disabled = backup.skillsDisabled;
  settings.skills = skills;
  if (backup.tools === null) delete settings.tools;
  else settings.tools = backup.tools;
  const general = objectOrEmpty(settings.general, 'general');
  if (backup.maxAttempts === null) delete general.maxAttempts;
  else general.maxAttempts = backup.maxAttempts;
  const plan = objectOrEmpty(general.plan, 'general.plan');
  if (backup.modelRouting === null) delete plan.modelRouting;
  else plan.modelRouting = backup.modelRouting;
  general.plan = plan;
  settings.general = general;
  if (backup.modelName === null) delete settings.model.name;
  else settings.model.name = backup.modelName;
  delete settings.pstack.liteBackup;
}

function writeAll(home, budget) {
  const geminiDir = path.join(home, '.gemini');
  const geminiMd = path.join(geminiDir, 'GEMINI.md');
  const settingsPath = path.join(geminiDir, 'settings.json');
  const settings = loadSettings(settingsPath);
  const model = objectOrEmpty(settings.model, `${settingsPath} model`);
  const pstack = objectOrEmpty(settings.pstack, `${settingsPath} pstack`);
  settings.pstack = pstack;
  settings.model = model;
  if (budget === 'lite') applyLite(settings);
  else revertLite(settings);
  pstack.lite = budget === 'lite';
  if (budget === 'lite') model.name = LITE_MODEL;
  else if (model.name === undefined) model.name = PARENT[budget];
  const agents = objectOrEmpty(settings.agents, `${settingsPath} agents`);
  const overrides = objectOrEmpty(
    agents.overrides,
    `${settingsPath} agents.overrides`,
  );
  const previous = objectOrEmpty(
    overrides['poteto-agent'],
    `${settingsPath} agents.overrides.poteto-agent`,
  );
  const modelConfig = objectOrEmpty(
    previous.modelConfig,
    `${settingsPath} agents.overrides.poteto-agent.modelConfig`,
  );
  modelConfig.model = budget === 'lite' ? LITE_MODEL : lower('pro', STEPS[budget]);
  previous.modelConfig = modelConfig;
  overrides['poteto-agent'] = previous;
  agents.overrides = overrides;
  settings.agents = agents;

  fs.mkdirSync(geminiDir, { recursive: true });
  upsertGeminiMd(geminiMd, roleBlock(budget));
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
  return { geminiMd, settingsPath, delegate: modelConfig.model, parent: model.name };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  if (args.help || !args.budget) {
    console.error(
      'Usage: node scripts/write-pstack-models.mjs --budget <large|medium|small|lite>',
    );
    process.exit(args.help ? 0 : 1);
  }
  if (!BUDGETS.has(args.budget)) {
    console.error(`Unknown budget ${args.budget}. Use large, medium, small, or lite.`);
    process.exit(1);
  }
  try {
    const written = writeAll(os.homedir(), args.budget);
    console.log(`Wrote ${written.geminiMd}`);
    console.log(`Wrote ${written.settingsPath}`);
    console.log(`budget ${args.budget}`);
    console.log(`poteto-agent model ${written.delegate}`);
    console.log(`model.name ${written.parent}`);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
