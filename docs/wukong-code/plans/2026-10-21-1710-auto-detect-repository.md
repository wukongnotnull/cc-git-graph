# Automatic chat repository detection implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use wukong-code:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tools → Wukong Git Graph opens the current chat repository without entering a path.

**Architecture:** Retain explicit repository and client roots precedence. When roots are unsupported, use the calling chat ID from MCP request metadata to query a short-lived local `codex app-server` using `thread/read` with `includeTurns:false`; validate identity and absolute cwd before existing Git-root normalization. No chat ID retains the previous cwd fallback; failed chat lookup must not silently open another repository.

**Tech Stack:** TypeScript, Node.js >=22, existing esbuild/Node test runner, installed Codex CLI JSON-RPC over stdio.

## Global constraints

- No added dependencies, HTTP listeners, global settings changes, transcript scans, or Git writes.
- Only `_meta.thread_id` / `_meta.threadId` identify the current chat. Validate UUIDs; conflicting aliases fail closed.
- Explicit repository and configured defaults bypass chat lookup. Existing zero/multiple/non-file client-root behavior stays unchanged.
- Query only `thread/read` with `includeTurns:false`; require response thread.id to equal requested ID and cwd to be absolute and NUL-free.
- Bound subprocess duration (5 seconds by default) and stdout (1 MiB). Drain stderr without exposing it. Close or kill and reap every owned subprocess on success, failure, and cancellation.
- Preserve per-graph repository identity, worktree canonicalization, and recoverable path form on lookup failure.
- README, PRD and AGENTS describe the new fallback and the remaining manual recovery case.

## Task 1: Automatic menu repository detection

**Files:**
- Create `codex/thread-repository.ts`: local Codex JSON-RPC client and metadata validation.
- Modify `codex/mcp-server.ts`: call the resolver only at the approved precedence point; forward request abort signal.
- Modify `codex/mcp.check.ts`: real MCP metadata routing tests and child-process protocol tests using temporary executable fixtures.
- Modify `README.md`, `PRD.md`, `AGENTS.md`: usage, lookup precedence and CLI prerequisite.

**Interfaces:**
- `readThreadDirectory(threadId: string, options?: {command?: string; args?: string[]; timeoutMs?: number; signal?: AbortSignal}): Promise<string>`
- `threadIdFromMeta(meta: Record<string, unknown> | undefined): string | undefined`
- `createGraphMcpServer` options gain `readThreadDirectory?: (threadId: string, signal?: AbortSignal) => Promise<string>` for boundary injection.

- [x] Add a failing real-MCP test using per-call `_meta` and injected lookup. Two chat IDs must yield two independent repository handles; explicit arguments and client root must skip lookup.

```ts
const result = await client.callTool({name: 'open_git_graph', arguments: {}, _meta: {thread_id: id}})
assert.equal(result.structuredContent?.repository, await realpath(directory))
```

- [x] Run `cd codex && ./node_modules/.bin/esbuild --tsconfig=tsconfig.json mcp.check.ts --bundle --platform=node --target=node22 --outfile=dist/mcp.check.cjs && node --test --test-name-pattern='calling chat' dist/mcp.check.cjs`; verify the failure concerns the missing lookup.
- [x] Add the resolver and routing. Use fixed JSON-RPC IDs 1 (initialize), 2 (thread/read); ignore notifications; send initialized notification only after successful initialize; reject RPC errors, invalid cwd, mismatched thread, oversized output, early exit, timeout and abort. Return only cwd, never thread preview/messages.
- [x] Add executable fixture tests covering request ordering and `includeTurns:false`, successful child exit, malformed/error/mismatched/relative responses, missing executable, timeout/abort and child reaping. Validate invalid/conflicting metadata before invoking lookup. Keep fixtures inside test-owned temporary directories.
- [x] Run the focused tests, then `npm --prefix codex test` and `npm --prefix codex run typecheck`.
- [x] Update docs with explicit/root/chat/cwd precedence. Record real installed-CLI lookup separately from desktop panel validation.
- [x] Run repository Claude checks, independent review, and `git diff --check`; fix actionable findings and rerun affected checks.
- [ ] Commit and open PR linked to issue #66. Build/reinstall after verification as authorized by this chat, and report any fresh-chat desktop validation limitation honestly.
