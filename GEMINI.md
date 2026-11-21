# pstack

This extension is a Gemini CLI port of Lauren Tan's pstack. The upstream project is https://github.com/cursor/plugins/tree/main/pstack and it is MIT licensed.

The SessionStart hook injects the adapter text from `docs/harness/gemini-cli.md` and the absolute extension root. Follow that injected text. Do not read a workspace-relative `docs/harness/gemini-cli.md`. That file is outside the project, so `read_file` fails unless the user started Gemini with `--include-directories` set to the extension root.

`/setup-pstack` writes model choices into `~/.gemini/GEMINI.md` and `~/.gemini/settings.json`. Those files override the defaults named in the adapter.

The shipped commands are `/poteto-mode`, `/setup-pstack`, `/investigation`, `/bug-fix`, `/feature`, and `/verification`.
