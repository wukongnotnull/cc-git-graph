---
name: git-graph
description: Use when the user invokes /git-graph or $git-graph, or asks to open the current local repository's Git graph in Codex.
---

# Git Graph

Open the requested local repository's read-only Git graph in the Codex browser side panel.

## Quiet interaction

For a normal invocation whose goal is only to open the graph, perform the work through tools without conversational output, subject to higher-priority instructions. Do not announce skill usage, narrate progress, print the URL in assistant messages, attach screenshots, or send a success confirmation.

After verifying the requested graph or its valid empty-repository state and keeping the tab open, end with no assistant text. Starting/reusing a server or a queued browser-open request alone is not success. Recoverable intermediate errors remain silent if another permitted approach succeeds.

If the panel cannot be opened or verified, or it shows an error instead of the requested repository, send one concise failure message explaining the cause and the next useful step. If the service is available but automatic opening fails, the complete local URL may be provided in that failure message. If the user explicitly requests a report or explanation, answer that request. Tool activity indicators are controlled by Codex; this skill controls assistant prose only.

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

Verify the browser shows **Git Graph** and the target repository's history or valid empty-repository state. Inspect without emitting screenshots into the conversation. A clear error in the page is a failure, not a successful open. Do not treat terminal output as proof that the panel opened. If no tool can open the side panel, provide the local URL and state that the page was not opened automatically.

The URL contains a local access credential: do not put it in issues, PRs, screenshots of the address bar, or tracked files. Keep Git operations read-only. This skill does not change Codex settings, add native Tools buttons, or stop unrelated services.
