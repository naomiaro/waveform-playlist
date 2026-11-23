---
name: release
description: Use when versioning or publishing packages, running pnpm release:version, changeset version or publish, any npm or pnpm publish, checking a published packument, writing a chore(release) commit or creating a GitHub release - and when npm answers EOTP, E404 or E403 during a publish.
---

# Releasing

No release is started unless the maintainer asks for one. Every PR that changes `packages/*/src` adds a changeset; that rule is in root `CLAUDE.md`.

## Versioning and publishing

**Stable Releases:** Publish without tag to update `@latest`. `dev` is in pre mode, so a stable release starts with `pre exit` ("From dev to main"); a prerelease is "Prereleases: `@next` from dev".

```bash
pnpm release:version   # changeset version — computes all bumps incl. the dependent cascade
pnpm release:publish   # pnpm build && changeset publish --no-git-tag
```

**Version Bumping — Changesets owns the math (since 2026-07-05):** every PR that changes `packages/*/src` adds a changeset (`pnpm changeset`; pick `patch` for `@dawcore/*` — zerover, never minor/major). Each package follows its own semver independently. At release time `pnpm changeset version` computes all bumps INCLUDING the exact-pin dependent cascade (validated against the 2026-07-05 manual closure: identical 13-package result; `onlyUpdatePeerDependentsWhenOutOfRange` keeps floating peer floors like dawcore's `>=0.0.13` untouched; private packages excluded via `privatePackages`). Review the version diff, then `pnpm release:publish` (= `pnpm build && changeset publish --no-git-tag`: builds everything first — no prepublish hooks exist — then publishes topologically, skipping versions already on the registry; safe to re-run after a partial failure). Don't name a script `version` — `pnpm version` resolves to pnpm's built-in, not the script. The old `pnpm version:bump` (`scripts/bump-version.js`) is REMOVED — it synced ALL packages to one version, incompatible with independent versioning. `changelog: false` — the hand-written GitHub release remains the record. Then the chore(release) commit + GitHub release as below. **`changeset version` CONSUMES the `.changeset/*.md` files** — reverting `packages/*/package.json` after a dry-run does NOT restore them; re-create the changeset (or revert `.changeset/` too) before re-running. Validation pattern for config changes: write a throwaway changeset bumping one package, run `pnpm release:version`, diff the computed closure against expectation, then revert everything including `.changeset/`.

**Independent Versioning:** `@dawcore/components` and `@dawcore/transport` have their own version schemes (0.x.x), separate from the main `@waveform-playlist/*` packages.

**First-time scoped packages:** New scoped packages (`@waveform-playlist/*`, `@dawcore/*`) need `--access public` on first npm publish:

```bash
pnpm publish --filter @waveform-playlist/NEW-PACKAGE --no-git-checks --access public
```

**Verifying fresh publishes:** `npm view` caches 404s — a just-published new package can look missing for minutes. Verify with `curl -s https://registry.npmjs.org/@scope%2fname` instead.

**Pre-publish workspace-dep sweep:** for every `workspace:*`/`workspace:^` dep of the packages being published, verify local version == registry latest (for a prerelease: the registry's `next`) (`curl -s https://registry.npmjs.org/...`) — a feature PR that bumps a package version without publishing it (e.g. media-element-playout 12.3.0 in #473) makes dependents' exact pins unresolvable at install time.

**Hand-written peer floors are not raised by changesets: check them at every release.** `onlyUpdatePeerDependentsWhenOutOfRange` leaves a floating floor (`">=7.0.0"`) alone, so it goes stale without anyone noticing: on 2026-11-14 the engine's peer range on core was `>=7.0.0` while it imported `createSourceLoader`, `createValueSource`, `isLoadingClip` and `assertTrackKind`, which exist only in the unreleased core 13 (four pending majors). When reviewing the output of `pnpm release:version`, grep each `peerDependencies` floor in `packages/*/package.json` and compare it with what the package imports at runtime from that peer; the engine's floor on core was raised to `>=13.0.0-0` on 2026-11-23, before the first prerelease (a floor above the workspace's version was then tried: the version runs give the same result), and `@dawcore/components`' floor on core (`>=12.7.0`) has not been checked. A floor above the workspace's current version prints `must depend on the current version` at every version run until the bump ("Prereleases" below says what that line means); two prerelease runs and the exit gave the expected versions with it.

**Republish cascade is MANDATORY — never publish a package without its dependents (the outbound direction of the sweep above; AUTOMATED by `changeset version` since 2026-07-05 — this note is the why, and the fallback procedure if changesets is bypassed):** regular `workspace:*` deps publish as **EXACT pins** in the tarball; `workspace:^` peers publish as carets (verified from packuments). Publishing pkg X without republishing every published package that lists X in `dependencies` leaves those dependents pinning the OLD X — consumers silently install duplicate/stale copies. This happened: the core@12.5.0/ui-components@13.1.1 release skipped the cascade, so browser@15.2.0 shipped `core 12.4.0` + `ui-components 13.1.0` pins until the next sweep (2026-07-05) cured it. Procedure: compute the transitive exact-pin dependent closure of every bumped package (grep `"<pkg-name>"` across `packages/*/package.json` `dependencies`), patch-bump + republish ALL of it in topological order, then curl the new packuments and check the `dependencies` pins are the fresh versions. Caret peers force a republish only when the bump escapes the range (any major; ANY bump for zerover `^0.0.x` peers like `@dawcore/*`).

**`workspace:*` in devDependencies does NOT trigger the republish cascade** — devDeps are build-time only (never published pins), so changesets correctly excludes such packages (e.g. transport/worklets in the 2026-07-12 annotation-suite release). When auditing a computed closure, check WHICH section a workspace ref lives in before suspecting a missed bump.

**Security-key-only 2FA (since 2026-10-28): `changeset publish` cannot publish from this session.** The account has no authenticator app, only a hardware key, so there is no OTP to type and npm has no TTY here — every package fails `EOTP` ("Open this URL in your browser to authenticate") before anything uploads, and `changeset publish` itself pre-prompts for a typed code. Procedure that works: `pnpm release:version` → review the closure → `pnpm build` → hand the user a dependency-ordered chain of `pnpm --filter <pkg> publish --no-git-checks && …` (toposort `dependencies` across `packages/*/package.json`) to paste into a REAL terminal, not the `!` prompt (npm's `auth-type=web` opens the browser for one key tap per package) → verify from here: `~/.npm/_logs` `http fetch PUT 202` + `verbose exit 0` per package is the immediate proof, packuments lag 3–8 minutes (poll with `Cache-Control: no-cache`) → chore(release) commit → GitHub release. `! npm login` fixes an expired token (`npm whoami` E401) but does not bypass 2FA for publishing. The `--otp` flow below applies only if an authenticator app is added as a second 2FA method.

**npm auth failures during `changeset publish` are disguised:** an EXPIRED token surfaces as `E404 Not Found - PUT …` ("could not be found or you do not have permission") on every package, not as a 401 — check `npm whoami` first (it returns the real E401). With 2FA-for-writes enabled on the account, `changeset publish` spawns `npm publish` with no TTY, so npm can't open its OTP prompt and fails with `E403 … Two-factor authentication or granular access token with bypass 2fa enabled is required` — even when the user runs it themselves. Fix: `pnpm exec changeset publish --no-git-tag --otp=<6-digit code>` (one code covers all packages in the run), or a granular token with 2FA bypass in `~/.npmrc`. Publish PUTs return `202` and packuments lag the CDN by 1–3 minutes — poll `curl` with `Cache-Control: no-cache` before concluding a publish failed (the npm debug log's `http fetch PUT 202` + `verbose exit 0` lines are the immediate proof).

**Build before publishing:** No package defines prepublish hooks — always run `pnpm --filter <pkg> build` before `pnpm publish`, or the tarball ships a stale `dist/`.

## Prereleases: `@next` from dev

`dev` is in changesets pre mode since 2026-11-23 (`.changeset/pre.json`, tag `next`): `pnpm release:version` there gives `x.y.z-next.N`, and the changeset files stay until pre mode is left. The procedure was run end to end on scratch branches that day (two iterations and the exit), except for the upload itself.

- **A prerelease:** `pnpm release:version` → review the versions → `pnpm build` → publish in dependency order as for a stable release, with **`--tag next` on every `pnpm publish`** → a `chore(release)` commit on `dev`. npm 11 refuses a prerelease version without a tag (`You must specify a tag using --tag when publishing a prerelease version`), so a forgotten tag fails and does not move `latest`; an older npm publishes it as `latest`, so check `npm --version` in the terminal that will publish. `main`, the release number in the root `package.json`, the git tag and the GitHub release are not touched: they belong to stable releases (the site's config throws on a root version that is not three numbers).
- **The next one:** each later run raises `N` for the packages with new changesets and for their dependents (`core@13.0.0-next.1` took `browser`, `ui-components` and the others to `next.1`; the engine, which only peers on core, stayed at `next.0`).
- **A stable release starts with `pnpm exec changeset pre exit`.** The versions `pnpm release:version` then gives are the ones a run without pre mode gives (compared for all 18 packages). Enter pre mode again afterwards (`pnpm exec changeset pre enter next`) in a PR of its own.
- **A hand-written peer range must admit the prereleases the peer will get, and every `peerDependencies` block is diffed after each `pnpm release:version`.** `>=12.7.0` does not match `13.0.0-next.0`: a range matches a prerelease only when one of its comparators has a prerelease on the same `major.minor.patch`, and changesets asks `semver.satisfies` without `includePrerelease`. Two separate things then happen (`@changesets/assemble-release-plan` `shouldBumpMajor`, `@changesets/apply-release-plan` `shouldUpdateDependencyBasedOnConfig`):
  - the range is rewritten to `>=<the new version>` (`>=13.0.0-next.0`), for any bump of the peer, a patch included. `pre exit` does not undo it: a stable `@dawcore/components` would have kept `@dawcore/wam >=0.0.5-next.0` and dropped wam 0.0.1 to 0.0.4;
  - when the peer's own bump is a minor or a major, the dependent is bumped as a MAJOR: `@dawcore/components` came out as `1.0.0-next.0` for core's and the engine's majors.

  The alternative that prevents both names the coming version: `>=13.5.0 || >=14.0.0-0`. Nine ranges have one: dawcore's on faust, midi, wam and transport (their next patch), on core and the engine (their pending major) and on worklets (which has no changeset yet, so all three: `>=12.0.0 || >=13.0.1-0 || >=13.1.0-0 || >=14.0.0-0`), the engine's on core (`>=13.0.0-0`, a real floor: it needs core 13) and playout's on the engine. An alternative covers one `major.minor.patch`, so it is right only for the bump the peer has now: a peer whose pending bump grows (a patch that becomes a minor) or a peer released as stable needs a new one. That is why the check is the diff: `git diff -- 'packages/*/package.json' | grep -B2 -A2 '>='` after every version run, before committing; a rewritten range or a dependent whose bump is larger than its changesets ask for means a range lacked its alternative. Restore, add it, run again.
- **`Package "X" must depend on the current version of "Y"`** (printed three times per run) means X's range on Y does not match Y's version in the workspace, and changesets leaves that edge out of its dependents graph for the run: a bump of Y does not reach X. It prints on `dev` for dawcore's ranges on transport and core, whose floors are above the released versions; harmless while dawcore has changesets of its own.
- **Who needs the alternative when installing:** npm does (it checks a peer with plain `semver.satisfies`); pnpm 8.15 accepts a prerelease for a plain floor, except where the floor is the prerelease's own version (`>=0.0.16` against `0.0.16-next.0`).
- **Workspace ranges need nothing:** `workspace:*` is published as the exact prerelease (`core@13.0.0-next.0`), `workspace:^` as a caret on it (`browser@^17.0.0-next.0`), read from packed tarballs.
- A fix released from `main` is a normal release: `main` has no `pre.json`.

## From dev to main

`dev` is where a release is prepared; `main` is the commit that npm `latest` was published from (root `CLAUDE.md`, "Two branches").

1. On `dev`: `pnpm exec changeset pre exit` (`dev` is in pre mode: "Prereleases" above; without it the versions are `-next.N`), then `pnpm release:version`, the release number in the root `package.json`, the stable announcement bar, the `chore(release)` commit, through a PR like any other change.
2. Publish from that commit (the hardware-key procedure above).
3. Move `main` to the release commit, named by its SHA (`dev` may have moved on since: `origin/dev:main` would publish unreleased work as the stable site and put the tag on it):

   ```bash
   git fetch origin
   RELEASE=<sha of the chore(release) commit on dev>
   git merge-base --is-ancestor origin/main "$RELEASE" && git push origin "$RELEASE:refs/heads/main"
   ```

   The push is a fast-forward and is refused when it would not be; never force it. When the ancestor check fails, a fix was committed on `main` and not merged back: merge `main` into `dev` first with a real merge commit (`gh pr merge --merge`, or a merge pushed to `dev` as `959f4e92` was), never a squash, which leaves the check failing. A fix released from `main` has bumped versions there, so expect that merge to conflict in `package.json` files (not tried).
4. Tag and release that commit: `gh release create v<release number> --target "$RELEASE" …`.

After the fast-forward `main`'s files are exactly `dev`'s. What `main` carried of its own is gone with it, as intended: on 2026-11-23 that was five redirect pages under `website/static/docs` and `website/static/examples`, for pages only the next docs had.

The link between the branches is the merge commit `959f4e92` on `dev` (`git merge -s ours`, 2026-11-23): it recorded the new `main`'s first commits as merged while keeping `dev`'s files. A push to `main` or `dev` deploys both versions of the site.

## The release number

**A release has one number: `version` in the root `package.json`** (maintainer, 2026-11-23; the idea is openDAW's SDK version, without its meta-package). The packages keep their independent versions; the release number names the set that was published together. It starts at 16.0.1, the release tagged `transport-engine-improvements`.

- **Bump it by hand in the `chore(release)` commit** (changesets leaves a private root alone): a major when any package in the release has a major, else a minor when any has a minor, else a patch. A release of `@dawcore/*` only is a patch.
- **The git tag is `v<release number>`** (`v17.0.0`). What the release is about goes in the GitHub release's title (`v17.0.0 — the arrangement`), and its notes list every published package with its version. Tags before `v16.0.1` are descriptive names and stay.
- **The docs read it.** The version dropdown of the site shows `v<release number>` for the stable build (`website/CLAUDE.md`, "Versions of the Site"). The docs of the release before are not kept: the stable site is replaced.
- **The stable build's announcement bar** (`releaseAnnouncement` in `website/docusaurus.config.ts`) names the release and links its notes: update it in the release commit.

## The commit, the tag and the GitHub release

- **A full release is THREE artifacts** — easy to do partially: (1) npm publish (`pnpm --filter <pkg> publish --no-git-checks`), (2) the `chore(release): pkg@x.y.z` commit on `dev`, which `main` is then moved to ("From dev to main"), (3) the GitHub release on the tag `v<release number>` (`gh release create`). "Bump and publish" naturally stops after (1)+(2) — the GitHub release is a separate step, easy to forget. Preview the tarball first with `pnpm --filter <pkg> publish --no-git-checks --dry-run` (shows files/version/tag/access before the irreversible publish); verify the publish landed with `curl -s https://registry.npmjs.org/@scope%2fname` (npm view caches 404s).
- **Release tags are `v<release number>`, not `pkg@version`** ("The release number" above; until 2026-11-23 they were feature names such as `optional-playout-engines`). `gh release create v<release number> --title "v<release number> — <what it is about>" --target <release commit's sha> --notes-file <path>` creates the tag + release; the release commit is `chore(release): pkg@x.y.z, …`, made on `dev`; `main` is moved to it first ("From dev to main"). Bumping workspace package versions does NOT change `pnpm-lock.yaml`.
- **GitHub Release Notes:** use `gh release create --notes-file <path>` (or `gh release edit --notes-file <path>`), NOT `--notes "$(cat <<'EOF')"`. Shell escapes in HEREDOCs mangle inline backticks and quotes inside code spans, leaving visible `\"` and `` \` `` in the rendered release body.
- **`npm version <v> --no-git-tag-version` may normalize unicode escapes** in package.json (e.g. `\u2014` becomes a literal `—`) — an extra diff line beyond `version`; harmless, commit it.
- **`@dawcore/components` has no published dependents** — only `website` (`workspace:*`, unpublished) depends on it, so bumping it is a SINGLE-package release, not a workspace-pin republish cascade. Verify republish scope with `grep -rl '"@dawcore/components"' packages/*/package.json` before assuming the cascade.
