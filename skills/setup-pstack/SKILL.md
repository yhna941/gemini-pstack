---
name: setup-pstack
description: Configure which Gemini models pstack uses per role. Detect aliases the CLI resolves and write them where Gemini CLI will read them. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write pstack's per-role models into the two files Gemini CLI reads.

- `~/.gemini/GEMINI.md`, between `<!-- pstack-models:start -->` and `<!-- pstack-models:end -->`. Gemini CLI loads this file as global context for every new session.
- `~/.gemini/settings.json`. The key `model.name` is the parent session model. The key `agents.overrides.poteto-agent.modelConfig.model` is the delegate model.

The only writer is `<pstack>/scripts/write-pstack-models.mjs`. `<pstack>` is the directory that contains `gemini-extension.json`. Do not hand-edit those keys in the same turn.

Read `docs/harness/gemini-cli.md` once before the steps below.

## Steps

### 1. Detect available models

The aliases Gemini CLI resolves are `auto`, `pro`, `flash`, and `flash-lite`. `inherit` is also valid. It means omit the subagent model field so the role uses the parent model.

Do not write a concrete `gemini-*` id unless the user typed that id, or it appeared in `/model` output or in `gemini` help this session. Never write a `claude-*` slug.

### 2. Load current state

If `~/.gemini/GEMINI.md` already contains the marker block, read the `# budget` line. That is the current budget. The script replaces the whole block on every run. Tell the user when a re-run will replace role lines they edited inside the block.

Leave `model.name` alone when it is already set. The script does that. Set it only when the key is absent.

### 3. Budget

Look at the user's words for `large`, `medium`, or `small`.

- `large` keeps `pro` for code, prose, and judgment, and `flash` for swarm workers.
- `medium` lowers one step. `pro` becomes `flash`. `flash` becomes `flash-lite`.
- `small` lowers two steps. Both land on `flash-lite`.

The ladder is `pro`, then `flash`, then `flash-lite`. No role is written above `pro`.

If the user named no budget, use `large` and say that you used the default. There is no question tool. Do not wait.

A panel line ships as one alias. Gemini CLI has one vendor, so the upstream three-seat panel does not survive. Say that. If the user asks for a second pass, they can put a second alias on that line after the script runs, then not re-run the script until they want the default block back.

### 4. Write

Run:

```bash
node <pstack>/scripts/write-pstack-models.mjs --budget <large|medium|small>
```

If `~/.gemini/settings.json` exists and is not a JSON object, stop. The script exits non-zero and writes nothing in that case. Tell the user the parse error. Do not delete the file.

The block looks like this for `large`.

```
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit` omits the subagent model field so the role uses the parent model.
# `auto`, `pro`, `flash`, and `flash-lite` are Gemini CLI aliases.
# Gemini CLI has one vendor. A panel line with one alias is one pass.
# defaults: 3
# budget: large (pro)
feature, refactoring: pro
bug-fix: pro
perf-issue: pro
hillclimb: pro
judgment and prose: pro
arena runners: pro
arena cross-judge pool: pro
swarm workers: flash
interrogate reviewers: pro
```

`medium` and `small` keep the same roles and lower the aliases as in step 3.

### 5. Confirm

Tell the user the budget, whether `model.name` was already set, the `poteto-agent` model, and that a new Gemini CLI session loads the block. Re-running this skill updates the block.

### 6. Offer a verification skill once

If the project has no skill that drives the real app, offer one sentence. "Want a project-local verification skill so an agent can drive the app and prove a change? I can generate one with /create-verification-skill." On yes, follow that skill and write under `.gemini/skills/`, as the adapter says. On no, stop offering.

`create-formal-verification-skill` is not in this port. Write `Skipped in Gemini CLI: create-formal-verification-skill. Not in this port.` and do not offer it.
