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
| Subagents | `Task` with `subagent_type` | Extension `agents/*.md`, plus built-ins such as `generalist` | degraded | Subagents are marked preview. They cannot call other subagents. Nested work runs in the current agent and writes the skip line. |
| `poteto-agent` | Cursor agent file, model `claude-opus-5-5-xhigh-fast`, `is_background: true` | `agents/poteto-agent.md` | degraded | `is_background` is not in the strict schema, so it is dropped. `model` is omitted so `settings.json` can set it. |
| `comment-sicko` | Cursor agent | `agents/comment-sicko.md`, copied | supported | `no-comments` calls this agent. |
| `generalPurpose` | Task subagent type | Built-in `generalist` | degraded | No extra tools beyond the session. |
| Multi-model review panel | Arena and interrogate spawn Fable, Opus, and Gemini seats | One vendor | degraded | The panel is one `pro` pass. A second alias on the role line is a later pass. The cross-vendor judge is skipped. |
| Model ids | Claude, Fable, and Gemini slugs, plus an effort token | Aliases `pro`, `flash`, `flash-lite`, `auto` | degraded | `large` is `pro` for judgment and `flash` for swarm workers. `medium` lowers one step. `small` lowers two. Nothing is written above `pro`. |
| Role rule file | `~/.cursor/rules/pstack-models.mdc` with `alwaysApply: true` | Markers in `~/.gemini/GEMINI.md`, which Gemini CLI loads as global context | degraded | `.mdc` is not read. The block is the role table. `model.name` and `agents.overrides.poteto-agent.modelConfig.model` in `~/.gemini/settings.json` are the keys the CLI enforces. |
| `AskQuestion` | Structured question tool | None | unsupported | Ask in the reply. `/setup-pstack` with no budget writes `large`. |
| Todo list tool | TodoWrite | Not part of the extension format | degraded | Use a todo tool if the session has one. Otherwise keep the list in the reply. |
| Bugbot | Cursor review bot | None | unsupported | Do not start, wait for, or configure Bugbot. Comments already on the PR are ordinary review threads. Classify them with `skills/poteto-mode/references/bugbot-triage.md`. |
| Automations | `automations/benny` | None | unsupported | Skip the step. Benny is not in this port. |
| Hooks | Not a pstack surface | Gemini CLI `hooks/hooks.json` | unsupported | This port ships no hooks. |
| MCP servers | Not required by the shipped playbooks | `mcpServers` in the manifest | unsupported | This port ships no MCP server. |
| Cloud agents | `environment: "cloud"` | None | unsupported | Use a local git worktree. Skip dashboard status. |
| Pull request tool | Cursor or Origin PR tool | None built into the extension | degraded | `gh pr create` with no `--draft`. |
| `/loop` | Cursor command the bug-fix playbook names | None | unsupported | Skip the step. |
| cursor-team-kit | `/deslop`, `control-ui`, `control-cli` | Not part of pstack or this port | unsupported | Skip the step. |
| Custom mode lock | Option-enter keeps `/poteto-mode` pinned | None | unsupported | Extension `GEMINI.md` is loaded while the extension is enabled. It does not pin the playbook. |
| Worktree scripts | `skills/poteto-mode/scripts/` | Copied, including `watch-pr` | supported | Run them with `node` or the bundled `watch-pr` entry. |
| Guide | `docs/guide/` | Not copied | unsupported | README plus this file. |

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

The rejected shape was rewriting every skill so it speaks Gemini names only. That makes a Cursor name unreadable in the skill, and every upstream edit becomes a manual merge. It does not remove the need for a table. Gemini CLI still cannot do the panel, Bugbot, or automations.

## Next

1. Port the remaining playbooks, still through the adapter, starting with refactoring, babysit, and shipping.
2. Add a real second model only if Gemini CLI grows a way to call a non-Gemini model. Until then, do not pretend `flash` is another vendor.
3. Re-check `TomlCommandDefSchema` and the local agent schema when `@google/gemini-cli` moves past 0.70.0. `scripts/validate-extension.mjs` encodes the checks this port depends on.
