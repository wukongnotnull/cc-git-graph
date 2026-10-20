---
name: git-graph
description: Use when the user invokes /git-graph or $git-graph, or asks to open the current local repository's Git graph in Codex.
---

# Git Graph

Open the requested local repository's read-only Git graph in the Codex browser side panel.

## Start or reuse the service

- The target is the current chat's working directory, unless the user names another repository. Do not substitute this skill's checkout as the target.
- Resolve this skill directory's real path (it may be symlinked). It lives at `<checkout>/codex/skills/git-graph`; two parents above the directory is the **launcher directory**, `<checkout>/codex`.
- If the launcher directory has no `node_modules/.bin/esbuild`, run `npm --prefix "<launcher directory>" ci`. This requires Node.js 22+ and Git. If a prerequisite is missing or installation fails, report the error without continuing.
- Build, then invoke the reusable launcher with quoted absolute paths:

```sh
npm --prefix "<launcher directory>" run build && npm --prefix "<launcher directory>" run open -- --repo "<target repository absolute path>"
```

Run this in a managed, persistent terminal session. A newly started service keeps running and prints `Git Graph started.` plus its full URL. A verified existing service prints `Git Graph reused.` and the same URL, then the launcher exits. Keep the first service's terminal alive; Ctrl+C stops it. Do not start a second server just because the first command is still running.

The launcher normalizes repository/subdirectory paths, validates the authenticated service identity and repository, and replaces dead or invalid cache records. A non-repository is an error; do not open a graph for a different directory. Runtime URL caches live in a user-private temporary directory, outside Git.

## Open and verify the side panel

Use the complete localhost URL from the launcher, including its `#` fragment. Prefer the Codex `open_in_codex` tool with a browser target, or the available in-app browser tool. Reuse an existing tab for the same URL when available. If the browser tool requires marking the result as a deliverable, do so to keep it open for the user.

Verify the browser shows **Git Graph** and the target repository's history, empty-repository state, or a clear error. Do not report that it opened based only on terminal output. If no tool can open the side panel, provide the local URL and state that the page was not opened automatically.

The URL contains a local access credential: do not put it in issues, PRs, screenshots of the address bar, or tracked files. Keep Git operations read-only. This skill does not change Codex settings, add native Tools buttons, or stop unrelated services.
