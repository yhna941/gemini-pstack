# What moved to Gemini CLI

This is a reference for the Gemini CLI port of pstack 0.15.46. Each row is one Cursor concept, the Gemini CLI mechanism that carries it, and the status.

Status values are `supported`, `degraded`, and `unsupported`. `degraded` means Gemini CLI has a related mechanism and this port uses it with a stated limit. `unsupported` means the step is skipped. The skip line is `Skipped in Gemini CLI: <step>. <reason>.`

The operational mapping the agent reads is [docs/harness/gemini-cli.md](harness/gemini-cli.md). It follows the shape of upstream `docs/harness/claude-code.md`. Skills keep Cursor names. The adapter renames them at read time. `setup-pstack` is the exception, because its job is to write the host's own config files.

Checked against gemini-cli commit `eecccfcd5aff25de5e78135ca20f7abe3f566955` and the published package `@google/gemini-cli@0.70.0` on 2026-11-21.

Sources:

- [Extension reference](https://github.com/google-gemini/gemini-cli/blob/eecccfcd5aff25de5e78135ca20f7abe3f566955/docs/extensions/reference.md)
- [Custom commands](https://github.com/google-gemini/gemini-cli/blob/eecccfcd5aff25de5e78135ca20f7abe3f566955/docs/cli/custom-commands.md)
- [Agent skills](https://github.com/google-gemini/gemini-cli/blob/eecccfcd5aff25de5e78135ca20f7abe3f566955/docs/cli/skills.md)
- [Subagents](https://github.com/google-gemini/gemini-cli/blob/eecccfcd5aff25de5e78135ca20f7abe3f566955/docs/core/subagents.md)
- `packages/cli/src/config/extension.ts` (`ExtensionConfig`)
- `packages/cli/src/services/FileCommandLoader.ts` (`TomlCommandDefSchema`, `prompt` required, `description` optional)
- `packages/core/src/config/models.ts` (aliases `auto`, `pro`, `flash`, `flash-lite`)
- `packages/core/src/agents/agentLoader.ts` (local agent frontmatter is a strict object)
- `packages/core/src/skills/skillLoader.ts` (a skill needs `name` and `description`)

## Concepts

| Concept | Cursor | Gemini CLI | Status | Fallback |
| --- | --- | --- | --- | --- |
| Extension package | `.cursor-plugin/plugin.json` | `gemini-extension.json` | supported | Install with `gemini extensions install`. |
| Always-on context | Skill body plus rules | `GEMINI.md` via `contextFileName` | supported | The file stays short and points at the adapter. |
| Slash commands | Skill invocation from `/` | `commands/<name>.toml` with a required `prompt` string | supported | `{{args}}` is the task text. |
| Skills | `skills/<name>/SKILL.md` | Extension `skills/<name>/SKILL.md`, activated on demand | supported | Copied skills are listed below. |
| `disable-model-invocation` | Cursor hides the skill until you invoke it | The loader ignores unknown frontmatter keys | unsupported | The `description` text is the only trigger. |
| Subagents | `Task` with `subagent_type` | Extension `agents/*.md`, plus `scripts/delegate.mjs` | degraded | Subagents are preview and cannot call other subagents. Nested work is a separate `gemini -p` process. |
| `poteto-agent` | Cursor agent file, model `claude-opus-5-5-xhigh-fast`, `is_background: true` | `agents/poteto-agent.md` | degraded | `is_background` is not in the strict schema, so it is dropped. `model` is omitted so `settings.json` can set it. |
| `comment-sicko` | Cursor agent | `agents/comment-sicko.md`, copied | supported | `no-comments` calls this agent. |
| `generalPurpose` | Task subagent type | Built-in `generalist` | degraded | No extra tools beyond the session. |
| Multi-model review panel | Arena and interrogate spawn Fable, Opus, and Gemini seats | `scripts/panel.mjs` runs `pro`, then `flash` | degraded | Both seats are Gemini. A Claude or Fable seat is impossible from this CLI. |
| Model ids | Claude, Fable, and Gemini slugs, plus an effort token | Aliases `pro`, `flash`, `flash-lite`, `auto` | degraded | `large` is `pro` for judgment and `flash` for swarm workers. `medium` lowers one step. `small` lowers two. Nothing is written above `pro`. |
| Role rule file | `~/.cursor/rules/pstack-models.mdc` with `alwaysApply: true` | Markers in `~/.gemini/GEMINI.md`, which Gemini CLI loads as global context | degraded | `.mdc` is not read. The block is the role table. `model.name` and `agents.overrides.poteto-agent.modelConfig.model` in `~/.gemini/settings.json` are the keys the CLI enforces. |
| `AskQuestion` | Structured question tool | `/ask` | degraded | There is no question widget. `/ask` puts the question in the reply. `/setup-pstack` with no budget writes `large`. |
| Todo list tool | TodoWrite | Not part of the extension format | degraded | Use a todo tool if the session has one. Otherwise keep the list in the reply. |
| Bugbot | Cursor review bot | `.github/workflows/review.yml` and `scripts/review-pr.mjs` | degraded | Cursor Bugbot is not started. The workflow calls Gemini when `GEMINI_API_KEY` is set, and exits 0 when it is not. Classify threads with `skills/poteto-mode/references/bugbot-triage.md`. |
| Automations | `automations/benny` | Copied procedures plus `.github/workflows/benny.yml` | degraded | There is no Slack wake and no Cursor Automations API. `workflow_dispatch` runs the prompt through `scripts/delegate.mjs`. |
| Hooks | Not a pstack surface | `hooks/hooks.json` `SessionStart` and `BeforeAgent` | supported | The hook points at the adapter, `scripts/delegate.mjs`, and `scripts/panel.mjs`. |
| MCP servers | Not required by the shipped playbooks | `mcpServers` in the manifest | unsupported | This port ships no MCP server. |
| Cloud agents | `environment: "cloud"` | Local git worktree plus `scripts/delegate.mjs` | degraded | The Cursor cloud dashboard is not available. |
| Pull request tool | Cursor or Origin PR tool | None built into the extension | degraded | `gh pr create` with no `--draft`. |
| `/loop` | Cursor command the bug-fix playbook names | `scripts/loop.mjs` and `/loop` | degraded | It repeats `gemini -m pro -p`. It is not Cursor's `/loop` scheduler. |
| cursor-team-kit | `/deslop`, `control-ui`, `control-cli` | Not part of pstack or this port | unsupported | Skip the step. |
| Custom mode lock | Option-enter keeps `/poteto-mode` pinned | `BeforeAgent` hook plus `GEMINI.md` | degraded | The hook adds adapter context every turn. It does not pin a mode the way Option-enter does. |
| Worktree scripts | `skills/poteto-mode/scripts/` | Copied, including `watch-pr` | supported | Run them with `node` or the bundled `watch-pr` entry. |
| Guide | `docs/guide/` | Not copied | unsupported | README plus this file. |

## Still impossible

Gemini CLI cannot call Claude or Fable. `scripts/panel.mjs` is two Gemini passes.

A subagent cannot call another subagent. `scripts/delegate.mjs` is a new process and does not share the parent tool session.

Cursor Automations, Slack wakes, and the Bugbot product are not in Gemini CLI. The workflows skip cleanly when `GEMINI_API_KEY` is unset.

There is no structured question widget.

## Playbooks

| Playbook | Status | Notes |
| --- | --- | --- |
| Every upstream playbook | supported | Copied. Each one has a slash command. |
| verification | degraded | Not an upstream file. Composed from the prove step in feature and bug-fix, `principle-prove-it-works`, `benchmark-checklist`, `blast-radius`, `create-verification-skill`, and `maintain-verification-skill`. |

## Skills

Every upstream skill directory is copied. `setup-pstack` is rewritten for Gemini CLI paths and aliases. `poteto-mode` keeps the upstream rules and adds a Gemini CLI preamble. `playbooks/verification.md` is new. `scripts/generate-commands.mjs` writes a slash command for each skill and playbook.

## Adapter shape

Two shapes were possible.

The shipped shape is one adapter file plus upstream skill text. Callers keep one way to read a skill. Host paths live in the adapter and in `setup-pstack`. This matches the Claude Code port.

The rejected shape was rewriting every skill so it speaks Gemini names only. That makes a Cursor name unreadable in the skill, and every upstream edit becomes a manual merge. It does not remove the need for a table. The panel, Bugbot, and automations on this branch are Gemini stand-ins. They are not the Cursor products.

## Next

1. Land the guide and `scripts/sync-upstream.mjs`.
2. Add a real second vendor only if Gemini CLI grows a way to call a non-Gemini model. Until then, do not pretend `flash` is another vendor.
3. Re-check `TomlCommandDefSchema` and the local agent schema when `@google/gemini-cli` moves past 0.70.0. `scripts/validate-extension.mjs` encodes the checks this port depends on.
