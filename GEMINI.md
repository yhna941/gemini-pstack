# pstack

Gemini CLI port of Lauren Tan's pstack (MIT). Upstream: https://github.com/cursor/plugins/tree/main/pstack

SessionStart injects the adapter. Do not read_file paths under the extension. Activate a skill by name.

`/setup-pstack lite` or `PSTACK_LITE=1` is the free-tier mode. It uses `gemini-3.5-flash-lite`, stays in one chat, and still requires a failing test first. Other budgets are `large`, `medium`, and `small`.
