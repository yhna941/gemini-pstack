# pstack

This extension is a Gemini CLI port of Lauren Tan's pstack. The upstream project is https://github.com/cursor/plugins/tree/main/pstack and it is MIT licensed.

Read `docs/harness/gemini-cli.md` once per session before you follow any skill in `skills/`. That adapter wins when a Cursor name and a Gemini name differ.

`/setup-pstack` writes model choices into `~/.gemini/GEMINI.md` and `~/.gemini/settings.json`. Those files override the defaults named in the adapter.

The shipped commands are `/poteto-mode`, `/setup-pstack`, `/investigation`, `/bug-fix`, `/feature`, and `/verification`.
