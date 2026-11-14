---
name: dependency-updates
description: Use when handling a Dependabot alert or PR, running pnpm update, adding or removing a pnpm.overrides entry, or moving a dependency between dependencies and peerDependencies.
---

# Dependency updates

Upgrades go to the latest stable only; bumping a 0.x peer range is a major (root `CLAUDE.md`, "Semantic Versioning").

## pnpm and Dependabot

- **Transitive Dependabot alerts**: try `pnpm update -r <pkg>...` first (refreshes the lockfile within parents' existing ranges) before adding a `pnpm.overrides` entry — most alerts are just stale lockfile patches the parent range already allows. Reserve overrides for a version an intermediary pins _below_ the fix (forced; may break upstream's tested range, e.g. js-yaml 3.x via gray-matter).
- **`pnpm update -r <names>` silently degrades to direct-deps-only** (pnpm 8) if you pass `--depth Infinity` OR if any named package is a direct dep somewhere in the workspace (e.g. `uuid`, `esbuild` in browser) — the transitive names in the same call are then skipped with no error. Keep direct deps out of the list and confirm by grepping `pnpm-lock.yaml` for the new versions.
- **Before removing a `pnpm.overrides` entry, check the FIXED alert history, not just open alerts** — `gh api --paginate 'repos/naomiaro/waveform-playlist/dependabot/alerts?state=fixed&per_page=100'` and test each `vulnerable_version_range` against the new lockfile; a dropped override silently reopens old alerts (serialize-javascript and uuid did, 2026-10-06). Scope a new selector to the parents' declared spec (`esbuild@^0.27.0`, not `esbuild@<0.28.1`) so unaffected consumers (vite 6's `esbuild ^0.25`) aren't dragged along. `pnpm audit` reads the npm advisory DB, which runs ahead of this repo's Dependabot list — use it to find in-range fixes worth taking early.
- **`dependencies`→`peerDependencies` move churns the lockfile** — it changes pnpm hoisting and can re-resolve unrelated transitive deps (e.g. `@types/react` 19→18 from a workspace `^18` vs react-19 mismatch). A pristine-base `pnpm install` no-op confirms the move (not pre-existing drift) is the cause; `--frozen-lockfile` still passes if internally consistent.
