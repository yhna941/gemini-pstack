# pstack for Gemini CLI

pstack helps an agent write less code and check it. This repository is a Gemini CLI port of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack) (MIT, Copyright (c) 2026 Lauren Tan). The upstream version copied here is 0.15.46.

The port follows the same idea as pstack's Claude Code adapter. Skills keep their Cursor names. [docs/harness/gemini-cli.md](docs/harness/gemini-cli.md) maps those names onto Gemini CLI. [docs/PORTING.md](docs/PORTING.md) lists what is supported, degraded, or absent.

## Install

Install [Gemini CLI](https://github.com/google-gemini/gemini-cli), then install this extension from a local checkout:

```bash
gemini extensions install . --consent
```

From GitHub:

```bash
gemini extensions install https://github.com/yhna941/gemini-pstack --consent
```

Restart Gemini CLI after install. Management commands such as `install` run in the terminal, not inside an interactive `gemini` session.

`--consent` skips the third-party extension warning. If Gemini CLI asks whether you trust the folder, answer yes. A headless shell can set `GEMINI_CLI_TRUST_WORKSPACE=true` for that command. Folder trust is separate from `--consent`.

To develop against a checkout without copying:

```bash
gemini extensions link .
```

The SessionStart hook injects the adapter text, so a normal project does not need an extra flag. If hooks are off, start Gemini with the extension root on the workspace list:

```bash
gemini --include-directories "$HOME/.gemini/extensions/pstack"
```

Headless scripts (`scripts/panel.mjs`, `scripts/delegate.mjs`, `scripts/loop.mjs`, `scripts/review-pr.mjs`) use `--model`, then `PSTACK_MODEL`, then `model.name` in `~/.gemini/settings.json`, then `pro`. `/setup-pstack` writes that settings key when it is absent. `review-pr.mjs` inlines the triage rubric. It does not ask the model to read an extension path.

## Free tier

`gemini-3.5-flash-lite` on the free tier allows about 250000 input tokens per minute. A full pstack session resends the extension text on every turn, and `/poteto-mode` can spawn `poteto-agent`, so one feature run can spend many turns and hit that limit.

`/setup-pstack lite` writes `model.name` as `gemini-3.5-flash-lite` and `pstack.lite: true`. `PSTACK_LITE=1` does the same for the hook without rewriting settings. Lite injects a short adapter, tells the chat to do the work itself, and still requires a failing test first, a rerun, and a commit.

`/setup-pstack lite` also writes `skills.disabled` for every skill except `poteto-mode`, `tdd`, `principle-prove-it-works`, and `setup-pstack`, sets `tools.core` to the coding allowlist (`read_file`, `read_many_files`, `glob`, `grep_search`, `list_directory`, `write_file`, `replace`, `run_shell_command`, `activate_skill`, `update_topic`, `write_todos`), sets `general.maxAttempts` to 2, and turns off `general.plan.modelRouting` so the CLI does not switch to a Pro model. Switching to `large`, `medium`, or `small` restores the previous skill list, tool list, attempt cap, and model routing, and deletes settings keys that were absent before lite.

Gemini CLI has no tokens-per-minute throttle. Lite tells the chat to batch reads with `read_many_files` and avoid bursts of tiny tool calls. `scripts/panel.mjs`, `scripts/delegate.mjs`, and `scripts/loop.mjs` wait `PSTACK_MIN_INTERVAL_MS` or `--pace` milliseconds between calls. On a 429 they wait `retryDelay` when the error includes it, otherwise 60 seconds, and retry up to twice. `review-pr.mjs` inlines `git diff` (or `base...HEAD`), capped at 120000 characters, and runs with `--approval-mode plan`.

`node scripts/context-size.mjs` estimates tokens as characters divided by 4. No API key was available, so this is not a live `usageMetadata` count. Tool docs from `@google/gemini-cli` 0.70.0 stand in for tool-schema size. On this tree:

| Piece | Full | Lite |
| --- | --- | --- |
| `GEMINI.md` | 108 | 108 |
| Skill name and description catalog | 3281 | 226 |
| SessionStart hook context | 1718 | 246 |
| Tool docs proxy | 18903 | 3683 |
| Total | 24010 | 4263 |

Disabled skills are omitted from the prompt (`getSkills` skips `skill.disabled`). `tools.core` is an allowlist, so tools that are not listed are not enabled. The wire schema is smaller than the docs proxy. The direction of the cut is what this table shows.

Check the manifest without an API key:

```bash
gemini extensions validate .
node scripts/validate-extension.mjs
```

`gemini extensions validate` checks `gemini-extension.json` and `GEMINI.md`. `node scripts/validate-extension.mjs` checks command TOML, skill frontmatter, agent frontmatter, and the setup writer.

Those checks were run with `@google/gemini-cli` 0.70.0. Install and validate do not need an API key. Running a command such as `/poteto-mode` does, because that calls the model.

## Use

Run these inside Gemini CLI. Text after the command is the task.

```text
/setup-pstack large
/poteto-mode fix the failing parser test, then open a PR
/investigation how does the cache key get built
/bug-fix the scroll jumps when the list is empty
/feature add a --json flag. text output stays the same
/verification prove the --json flag against the sample project
```

`/setup-pstack` writes a role table between markers in `~/.gemini/GEMINI.md` and sets `agents.overrides.poteto-agent.modelConfig.model` in `~/.gemini/settings.json`. It sets `model.name` only when that key is missing. Budgets are `large`, `medium`, and `small`. With no budget, the command uses `large`.

A new session loads the role table because Gemini CLI reads `~/.gemini/GEMINI.md`.

## What is in this port

Commands: `/poteto-mode`, `/setup-pstack`, `/investigation`, `/bug-fix`, `/feature`, `/verification`.

Playbooks: every upstream playbook, plus verification. Verification is not an upstream playbook. It is the prove step, written out so the command has a file to open.

Skills: every upstream skill. `setup-pstack` is the Gemini CLI rewrite. The inventory is in [docs/PORTING.md](docs/PORTING.md).

Agents: `poteto-agent` and `comment-sicko`.

## What this port leaves out

Gemini CLI cannot call Claude or Fable. `scripts/panel.mjs` runs `pro`, then `flash`.

A subagent cannot call another subagent. `scripts/delegate.mjs` starts a new `gemini -p` process.

Cursor Bugbot, Slack wakes, and the Automations API are absent. `.github/workflows/review.yml` and `benny.yml` call Gemini when `GEMINI_API_KEY` is set. There is no question widget. `/ask` writes the question in the reply.

The upstream guide is in [docs/guide](docs/guide). Commit identity and the upstream diff command are in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE) and [NOTICE](NOTICE). Upstream pstack is Copyright (c) 2026 Lauren Tan. Port-specific files are Copyright (c) 2026 yhna941.
