# Contributing

## Commit identity

Every commit is authored and committed as `yhna <121744067+yhna941@users.noreply.github.com>`.

`user.name` is `yhna`. `user.email` is `121744067+yhna941@users.noreply.github.com`. Set `GIT_COMMITTER_NAME` and `GIT_COMMITTER_EMAIL` to those same values. GitHub uses this name when it rebase-merges.

```bash
export GIT_AUTHOR_NAME=yhna
export GIT_AUTHOR_EMAIL=121744067+yhna941@users.noreply.github.com
export GIT_COMMITTER_NAME=yhna
export GIT_COMMITTER_EMAIL=121744067+yhna941@users.noreply.github.com
```

## Commit messages

Use a conventional commit. The subject is `type(scope): subject`, in the same shape as the commits already on main.

## Upstream drift

`node scripts/sync-upstream.mjs --self-test` checks the comparer. `node scripts/sync-upstream.mjs` clones `cursor/plugins` `pstack` and fails when a copied skill or guide file differs and is not in `scripts/upstream-allowlist.txt`. `--strict` also fails when an upstream file is missing. Files this port rewrites on purpose are in that allowlist.
