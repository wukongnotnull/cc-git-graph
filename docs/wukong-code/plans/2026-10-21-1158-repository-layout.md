# Repository Layout Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use wukong-code:subagent-driven-development (recommended) or wukong-code:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Group Claude and Codex plugin implementation files under `claude/` and `codex/` while keeping repository documentation and marketplace entry points easy to find at the root.

**Architecture:** Keep repository-level configuration, docs, and marketplace registries in the root. Move the Claude plugin manifest, hooks, domain types, and its TypeScript/CI config into `claude/`; leave the Codex plugin project in `codex/`. Update consumers and validators to use the new paths without changing plugin IDs, versions, behavior, or installation commands.

**Tech Stack:** Claude Code plugin CLI 2.1.299 in CI; TypeScript 5.6.3; Node.js 22; Codex plugin tests and build scripts under `codex/`.

## Global Constraints

- Keep Claude and Codex plugin IDs and versions unchanged.
- Keep the root `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json` entry points.
- Keep the Claude marketplace install command from the root README unchanged.
- Run `claude plugin validate .`, `claude plugin validate claude`, `claude plugin test claude`, `npx -y -p typescript@5.6.3 tsc -p claude/ci`, `npm --prefix codex test`, and `npm --prefix codex run typecheck`.
- Keep `.github/workflows/ci.yml` pinned to Claude Code 2.1.299.
- Preserve local generated Claude engine types under `claude/.claude-plugin/types/` and ignore that path.
- Update README and PRD when the documented repository structure or maintenance commands change.
- Preserve archived design and implementation-plan documents as historical records; update current `README.md`, `PRD.md`, and `AGENTS.md` references.

---

## File Map

| Path | Responsibility after refactor |
|---|---|
| `.claude-plugin/marketplace.json` | Root Claude marketplace registry; points to `./claude` |
| `claude/.claude-plugin/plugin.json` | Claude plugin manifest |
| `claude/hooks/` | Claude plugin implementation and tests |
| `claude/types/` | Claude plugin domain and state types |
| `claude/ci/` | Claude Code type snapshot and CI TypeScript config |
| `claude/tsconfig.json` | Claude plugin TypeScript config |
| `.github/workflows/ci.yml` | Validates root marketplace and Claude plugin; checks both products |
| `.gitignore` | Ignores generated Claude types and Codex build output at their new/current locations |
| `codex/package.check.ts` | Verifies built Codex package and root marketplace, plus Claude manifests at their new locations |
| `README.md` | User install steps and maintainer validation commands |
| `PRD.md` | Product and delivery structure |
| `AGENTS.md` | Repository maintenance guidance and command paths |

The existing root `tsconfig.json` and `ci/` move intact to `claude/tsconfig.json` and `claude/ci/`. Their relative includes and `extends` remain valid because their referenced files move with them. The Claude manifest's `types` value remains `./types/index.d.ts`, resolved from the plugin root `claude/`.

## Task 1: Move Claude plugin files into `claude/`

**Files:**
- Move: `.claude-plugin/plugin.json` → `claude/.claude-plugin/plugin.json`
- Move: `hooks/` → `claude/hooks/`
- Move: `types/` → `claude/types/`
- Move: `ci/` → `claude/ci/`
- Move: `tsconfig.json` → `claude/tsconfig.json`
- Modify: `.claude-plugin/marketplace.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: current root Claude plugin manifest, hooks, types, and CI config.
- Produces: a complete Claude plugin rooted at `claude/`, with the root marketplace pointing at it.

- [ ] **Step 1: Create the destination and move tracked Claude files**

Run from the repository root:

```bash
mkdir -p claude/.claude-plugin
git mv .claude-plugin/plugin.json claude/.claude-plugin/plugin.json
git mv hooks claude/hooks
git mv types claude/types
git mv ci claude/ci
git mv tsconfig.json claude/tsconfig.json
```

Expected: all Claude source and type-checking files are below `claude/`; `.claude-plugin/marketplace.json` remains in the root.

- [ ] **Step 2: Preserve generated local type configuration and update ignore path**

If `.claude-plugin/types/` exists locally, move it so the Claude TypeScript config can still resolve it:

```bash
mkdir -p claude/.claude-plugin
if [ -d .claude-plugin/types ]; then mv .claude-plugin/types claude/.claude-plugin/types; fi
```

Set `.gitignore` to:

```gitignore
claude/.claude-plugin/types/
node_modules/
codex/dist/
```

Expected: generated engine types are ignored at the Claude plugin's new path; Codex build output remains ignored.

- [ ] **Step 3: Point the root Claude marketplace to the new plugin directory**

In `.claude-plugin/marketplace.json`, change the sole plugin entry's `source` from `./` to `./claude`. Preserve its `name`, `version`, and description.

Expected: `claude plugin validate .` validates the root marketplace and the source points to a directory containing `claude/.claude-plugin/plugin.json`.

- [ ] **Step 4: Check the moved TypeScript project paths**

Run:

```bash
npx -y -p typescript@5.6.3 tsc -p claude/ci
```

Expected: type-check passes with the moved type snapshot and source files. If it fails due to a path, update only the moved TypeScript config that owns that path, then rerun this command.

## Task 2: Update CI and automated path assertions

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `codex/package.check.ts`

**Interfaces:**
- Consumes: the new Claude plugin root `claude/` and root marketplace registry.
- Produces: CI and the packaged Codex test asserting the new Claude plugin location and preserved root marketplace entry point.

- [ ] **Step 1: Update the Claude CI commands**

In `.github/workflows/ci.yml`, preserve the Claude Code install pin `2.1.299` and set the validation/test/type-check steps to:

```yaml
      - name: Validate the marketplace
        run: claude plugin validate .
      - name: Validate the plugin
        run: claude plugin validate claude
      - name: Run the plugin tests
        run: claude plugin test claude
      - name: Type-check
        run: npx -y -p typescript@5.6.3 tsc -p claude/ci
```

Leave the Codex job commands and cache path unchanged.

- [ ] **Step 2: Update the Codex package check for the Claude manifest path**

In `codex/package.check.ts`, change the Claude plugin manifest read to:

```ts
const claudePlugin = await readJson(resolve(__dirname, '../../claude/.claude-plugin/plugin.json'))
```

Keep the root marketplace read at `../../.claude-plugin/marketplace.json` and add this assertion beside its other marketplace assertions:

```ts
assert.equal(claudeMarketplace.plugins[0].source, './claude')
```

Expected: the check covers both the moved Claude plugin manifest and the root Claude marketplace path.

- [ ] **Step 3: Run the path assertion through Codex tests**

Run:

```bash
npm --prefix codex test
```

Expected: the Codex build succeeds and all `*.check.ts` tests pass, including the package check.

## Task 3: Update current docs and verify the repository structure

**Files:**
- Modify: `README.md`
- Modify: `PRD.md`
- Modify: `AGENTS.md`
- Review: `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, `.codex/environments/environment.toml`, `codex/package.check.ts`

**Interfaces:**
- Consumes: final directory and command paths from Tasks 1 and 2.
- Produces: consistent user-facing installation guidance and maintenance instructions.

- [ ] **Step 1: Update the README's maintainer commands**

Keep the normal Claude and Codex install instructions intact. Change only Claude developer validation commands to:

```text
claude plugin validate .
claude plugin validate claude
claude plugin test claude
npx -y -p typescript@5.6.3 tsc -p claude/ci
```

Keep Codex commands prefixed with `npm --prefix codex`.

- [ ] **Step 2: Update PRD and AGENTS structure/path descriptions**

In `PRD.md`, describe the root as the repository, the Claude plugin as `claude/`, the Codex plugin as `codex/`, and `.claude-plugin/marketplace.json` as the root Claude marketplace. Update its quality and delivery references to the new validator and type-check paths.

In `AGENTS.md`, change Claude implementation paths (`hooks/`, `types/`, `ci/`, `.claude-plugin/plugin.json`) and Claude commands to their `claude/` locations. Update the release rule to compare `claude/.claude-plugin/plugin.json` with the root `.claude-plugin/marketplace.json`. Leave Codex paths such as `codex/`, `.agents/plugins/marketplace.json`, and the Codex Action command intact.

- [ ] **Step 3: Audit active references for moved paths**

Run:

```bash
if rg -n --hidden --glob '!.git/**' --glob '!docs/**' '(^|[[:space:]`(])(hooks/|types/|ci/|\.claude-plugin/plugin\.json|plugin test \.|tsc -p ci)' .; then
  echo 'Obsolete root Claude paths found'
  exit 1
else
  result=$?
  test "$result" -eq 1
fi
```

Expected: no obsolete root Claude implementation paths or commands remain outside `docs/`. The excluded docs are historical design and implementation plans that describe the original layout.

- [ ] **Step 4: Run the complete required validation set**

Run each command from the repository root:

```bash
claude plugin validate .
claude plugin validate claude
claude plugin test claude
npx -y -p typescript@5.6.3 tsc -p claude/ci
npm --prefix codex test
npm --prefix codex run typecheck
```

Expected: all commands exit successfully. `npm --prefix codex test` builds the Codex package and runs its real stdio package tests.

- [ ] **Step 5: Review the final tree and whitespace**

Run:

```bash
git diff --check
git status --short
test -f claude/.claude-plugin/plugin.json
test ! -f tsconfig.json
node -e "const m = require('./.claude-plugin/marketplace.json'); if (m.plugins.length !== 1 || m.plugins[0].source !== './claude') process.exit(1)"
```

Expected: no whitespace errors; the Claude plugin manifest exists under `claude/`; the root TypeScript config has moved; the root marketplace points to it; Claude source/config is under `claude/`; Codex source is under `codex/`; root-level docs and marketplace/config entry points remain present.
