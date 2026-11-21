# pstack in Gemini CLI

pstack skills use Cursor names. In Gemini CLI, read this file once per session, then map each Cursor name with the tables below. `<pstack>` means the extension root, the directory that holds `gemini-extension.json`, `skills/`, and `docs/`. If a Cursor field has no row, drop it and say so. Never pass a field or value the tool schema rejects.

When a step needs a product Gemini CLI does not have, write one line and continue. The line is `Skipped in Gemini CLI: <step>. <reason>.` Do not stop, ask, or retry. When a later step needs what the skipped step made, leave a placeholder and name it in the line.

## Tools

| Cursor | Gemini CLI |
| --- | --- |
| `Task` | Call the subagent whose name matches the role. Shipped agents are `poteto-agent` and `comment-sicko`. The built-in `generalist` is the general-purpose agent. You can also start a prompt with `@poteto-agent`. |
| `AskQuestion` | No such tool. Ask in the reply. `/setup-pstack` with no budget writes `large` and says so. |
| Open a todolist, or copy steps into the todolist tool | Use a todo tool if the session has one. Otherwise keep the list in the reply and update it at each phase. |
| Run another pstack skill (`/name` or "the **name** skill") | Activate skill `<name>`, or read `<pstack>/skills/<name>/SKILL.md`. When you tell the user to type it, write `/<name>`. |
| `Grep`, `Glob` | Use the search tools the session already has. |

## Subagent fields

| Cursor | Gemini CLI |
| --- | --- |
| `subagent_type: generalPurpose` | `generalist` |
| `poteto-agent` | `poteto-agent` |
| `comment-sicko` | `comment-sicko` |
| `model:` a Cursor slug | A Gemini CLI alias, `pro`, `flash`, `flash-lite`, or `auto`, or a concrete `gemini-*` id you have seen this session. Never pass a `claude-*` or `fable` slug. |
| `auto` or `inherit-parent` | Omit the subagent `model` field. In the role file this value is the word `inherit`. |
| `readonly: true` | Tell the subagent not to edit files, and check `git status` afterward. |
| `run_in_background` | Omit. |
| `resume` | Start a new subagent and paste the earlier result into its brief. |
| `environment: "cloud"` | A local git worktree. Name the branch the worker checks out. |
| A nested spawn, from inside a subagent | Do the work yourself. Subagents cannot call other subagents. Write the skip line. |

Subagents are a preview feature. The main agent may spawn them. A subagent may not spawn them.

## Models

Gemini CLI runs Gemini models only. There is one vendor.

| Cursor | Gemini CLI |
| --- | --- |
| `claude-opus-5-5-xhigh-fast` and the other xhigh code, prose, and judgment defaults | `pro` |
| `claude-opus-5-5-high-fast` and other swarm-worker defaults | `flash` |
| `claude-fable-5-2-high` | `pro`. Say that Fable is not available. |
| `gemini-4-neon-*` | `pro` for `xhigh` and `high`, `flash` for `medium`, `flash-lite` for `low`. |
| `~/.cursor/rules/pstack-models.mdc` | The block in `~/.gemini/GEMINI.md` between `<!-- pstack-models:start -->` and `<!-- pstack-models:end -->`. Gemini CLI loads that file into every new session. If the block or the role line is missing, use the default in the Models table. |
| `agents.overrides.poteto-agent.modelConfig.model` in `~/.gemini/settings.json` | The model the `poteto-agent` subagent runs. `/setup-pstack` writes it from the `feature, refactoring` role. |
| `model.name` in `~/.gemini/settings.json` | The parent session model. `/setup-pstack` sets it only when the key is absent. |
| A panel of three vendors | Run the `pro` seat. If the role line lists a second alias, run that pass after the first. Say the panel is single-vendor. Skip the cross-vendor judge. |

The aliases are the ones `packages/core/src/config/models.ts` resolves in gemini-cli commit `eecccfcd5aff25de5e78135ca20f7abe3f566955`. `pro`, `flash`, `flash-lite`, and `auto` are the values to write. Write a concrete `gemini-*` id only when the user typed it or it appeared in `/model` output this session.

## setup-pstack

Follow `skills/setup-pstack/SKILL.md`. The script `scripts/write-pstack-models.mjs` is the only writer for the role block and the `poteto-agent` override. Do not also hand-edit those keys in the same turn.

## Paths

| Cursor | Gemini CLI |
| --- | --- |
| `.cursor/skills/`, `~/.cursor/skills/` | `.gemini/skills/`, `~/.gemini/skills/`. Extension skills live in `<pstack>/skills/`. |
| `.cursor/rules/*.mdc` | `~/.gemini/GEMINI.md`. Gemini CLI does not read `.mdc` files. |
| `.cursor-plugin/plugin.json` | `gemini-extension.json` |
| A project verification skill path written by `create-verification-skill` | `.gemini/skills/verify-<app>/SKILL.md` |

## Cursor-only features

| Cursor | Gemini CLI |
| --- | --- |
| Cursor Automations, routines, and webhooks | Skip with the line. |
| Bugbot, starting it, waiting for it, or configuring it | Skip with the line. Review comments that are already on the PR are ordinary threads. Classify them with `<pstack>/skills/poteto-mode/references/bugbot-triage.md`. |
| Cursor cloud agents and the cloud dashboard | Skip with the line. A cloud environment field maps to a local git worktree. |
| A built-in PR tool | Use `gh pr create` with no `--draft`. That is not a skip. |
| `/deslop`, `control-ui`, and `control-cli` from cursor-team-kit | Skip with the line. Those skills are not in this extension. |
| `/loop` | Skip with the line. |
| `disable-model-invocation` | Gemini CLI ignores this field. The skill `description` is what decides activation. |
| A playbook file that is not in `skills/poteto-mode/playbooks/` | Skip with the line. Do not invent the file. |

## Playbooks in this port

Every upstream playbook is in `skills/poteto-mode/playbooks/`, plus `verification`.

`verification` is not an upstream playbook. It is the prove step from feature and bug-fix, written so `/verification` has a file to open. The upstream text it follows is `principle-prove-it-works`, `benchmark-checklist`, `blast-radius`, `create-verification-skill`, and `maintain-verification-skill`.
