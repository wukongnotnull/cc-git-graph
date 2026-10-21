---
name: git-graph
description: Use when the user invokes /git-graph or $git-graph, or asks to open a local repository's Git graph in Codex.
---

# Wukong Git Graph

Open the requested repository in the installed Wukong Git Graph plugin's MCP Apps conversation panel. The default surface is the plugin panel.

## Quiet interaction

For a normal invocation whose only goal is to open the graph, use tools without conversational output, subject to higher-priority instructions. Do not announce skill usage, narrate progress, attach screenshots, print URLs, or send success prose. Tool activity indicators remain controlled by Codex.

After verifying the requested graph or its valid empty-repository state and leaving the panel open, end with no assistant text. If opening or verification fails, send one concise failure message with the cause and next useful step. If the user requests an explanation or report, answer that request. Higher-priority instructions can require messages.

## Open the plugin panel

1. Resolve the target to the **current chat's absolute working-directory path**, unless the user explicitly names another local repository or worktree. Pass that absolute path even when the MCP tool makes `repository` optional. A subdirectory is valid: the server resolves its repository root. Never substitute this skill's directory, the plugin cache, or its source checkout as the target.
2. Find the installed Wukong Git Graph MCP tool `open_git_graph` (the host may prefix its tool name). Call it with `repository` set to the target absolute path, for example `{"repository":"/absolute/path/to/current/project"}`. The server retains a separate graph handle for each opened repository. Do not start or reuse an HTTP service for this path.
3. Inspect the resulting **MCP Apps** panel using available panel inspection tooling. If using browser tooling, select the existing `mcpapps` surface; do not create a website tab. Verify that the panel shows **Wukong Git Graph**, the requested repository root, and its history or valid empty-repository state. Inspect without emitting a screenshot into the conversation. Preserve the panel for the user.

Calling the tool alone is not success. An unverified panel, wrong repository, UI error, or queued open without visible verification is a failure. A non-repository is an error; never silently open a different repository. Empty Git repositories are supported and count as success when the empty state is verified.

## Missing plugin or unavailable panel

If `open_git_graph` is missing or Codex reports an unknown MCP server, explain that the formal **Wukong Git Graph** plugin must be installed/enabled and loaded in a **new local project chat**. Existing chats can retain stale tool bindings after installation or updates. The plugin also provides **More tools → Plugins and MCPs → Wukong Git Graph**. Do not treat that menu as proof a tool call or panel render succeeded.

If tools can open the graph but no available tool can inspect the MCP Apps panel, state that the panel could not be verified. Do not claim success or fall back to a guessed website. Do not install plugins globally, create chats, change settings, or replace an existing user skill as part of opening a graph.

## Explicit browser fallback

Use the HTTP/browser path **only when the user explicitly requests the browser fallback**. It requires a source checkout with `codex/package.json`; the installed self-contained plugin does not contain the HTTP launcher. Locate that checkout independently from the target repository. If it is unavailable, report that prerequisite.

From the source checkout, run `npm --prefix codex ci` when dependencies are absent, then `npm --prefix codex run build` and `npm --prefix codex run open -- --repo "<target absolute path>"` in a persistent terminal. Use the launcher's complete authenticated localhost URL, including its fragment, to open and verify the browser side panel. Reuse a verified same-repository service; keep its owning terminal alive and use Ctrl+C to stop it. Never put the credential-bearing URL in issues, PRs, screenshots of the address bar, or tracked files.

Keep all Git operations read-only. The MCP process lifecycle belongs to Codex; closing a panel does not require stopping unrelated processes.
