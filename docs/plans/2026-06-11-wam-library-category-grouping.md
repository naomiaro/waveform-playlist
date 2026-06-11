# WAM Library Category Grouping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pass the registry `category` field through `fetchWamLibrary`, and use it in the dawcore-wam example's community picker to group out instrument/MIDI/video plugins that can't be inserted into an effects chain.

**Architecture:** Two independent layers. (1) `@dawcore/wam`'s manifest parser gains a `category?: string[]` passthrough on `WamLibraryEntry`, boundary-validated like the existing `keywords` field. (2) The example's picker partitions entries on that field — insertable rows stay as-is, non-insertable rows render in a dimmed, click-less section. `createWamInstance`'s descriptor validation remains the real gate; the URL input is the escape hatch for miscategorized plugins.

**Tech Stack:** TypeScript (tsup package), Vitest with injectable `fetchFn` (no network in tests), vanilla JS in a Vite example HTML page.

**Spec:** `docs/specs/2026-06-11-wam-library-category-grouping-design.md`

---

### Task 1: `category` passthrough in `fetchWamLibrary`

**Files:**
- Modify: `packages/dawcore-wam/src/library.ts` (interface ~line 15, `parseObjectEntry` ~line 235)
- Test: `packages/dawcore-wam/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing tests**

In `packages/dawcore-wam/__tests__/library.test.ts`, inside the existing `describe('fetchWamLibrary — optional fields', ...)` block, add after the `'filters non-string items out of keywords'` test:

```typescript
  it('passes through category as a string array', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        category: ['Effect', 'Reverb'],
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].category).toEqual(['Effect', 'Reverb']);
  });

  it('wraps a bare-string category in an array', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        category: 'Effect',
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].category).toEqual(['Effect']);
  });

  it('filters non-string items out of category', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        category: ['Effect', 7, null, 'Reverb'],
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].category).toEqual(['Effect', 'Reverb']);
  });
```

Then extend the existing `'drops malformed optional fields without skipping the entry'` test in the same describe block — add `category: 42` to the entry object so it reads:

```typescript
  it('drops malformed optional fields without skipping the entry', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        description: 42,
        vendor: { name: 'nested' },
        thumbnail: false,
        keywords: 'effect',
        category: 42,
      },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { name: 'Reverb', url: 'https://plugins.example.com/reverb/index.js' },
    ]);
  });
```

Finally, in `describe('fetchWamLibrary — real-world manifests', ...)`, the `'parses the webaudiomodules.com community registry (burns-audio pack)'` test asserts `entries[1]` with `toEqual` — the fixture already carries `category: ['Effect', 'Distortion']`, so once passthrough lands this assertion fails unless updated. Update the expected object to include it:

```typescript
    expect(entries[1]).toEqual({
      name: 'Simple Distortion',
      url: 'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/index.js',
      description: 'Simple waveshaper-based distortion with variable curve and gain',
      vendor: 'Sequencer Party',
      thumbnail:
        'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/screenshot.png',
      keywords: ['effect', 'distortion'],
      category: ['Effect', 'Distortion'],
    });
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd packages/dawcore-wam && npx vitest run __tests__/library.test.ts`

Expected: the three new tests FAIL (`entries[0].category` is `undefined`) and the updated real-world test FAILS (received object lacks `category`). The extended malformed-fields test PASSES (parser already ignores unknown fields). TypeScript may also flag `entries[0].category` as a non-existent property — that's the same red state.

- [ ] **Step 3: Implement the passthrough**

In `packages/dawcore-wam/src/library.ts`, add to the `WamLibraryEntry` interface (after `keywords?: string[];`):

```typescript
  /** Registry categories (e.g. "Effect", "Instrument", "MIDI"). Normalized to an array. */
  category?: string[];
```

In `parseObjectEntry`, after the `keywords` block (ends ~line 237), add:

```typescript
  if (Array.isArray(raw.category)) {
    entry.category = raw.category.filter((c): c is string => typeof c === 'string');
  } else if (typeof raw.category === 'string' && raw.category.trim() !== '') {
    entry.category = [raw.category];
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore-wam && npx vitest run __tests__/library.test.ts`

Expected: all tests PASS.

Then run the whole package suite and typecheck:

Run: `cd packages/dawcore-wam && npx vitest run && pnpm typecheck`

Expected: all PASS, no type errors. (Vitest in this monorepo can leave orphaned processes — if `pgrep -f vitest` shows strays afterwards, `pkill -f vitest`.)

- [ ] **Step 5: Lint and commit**

From the repo root:

```bash
pnpm lint
git add packages/dawcore-wam/src/library.ts packages/dawcore-wam/__tests__/library.test.ts
git commit -m "feat: pass category through fetchWamLibrary entries"
```

If `pnpm lint` reports formatting, run `pnpm format` first and re-stage.

---

### Task 2: Grouped community picker in the dawcore-wam example

**Files:**
- Modify: `examples/dawcore-wam/index.html` (CSS `.library-entry` block ~line 88-106; picker render loop ~line 482-519)

Note: this file is intentionally **outside lint scope** — match the existing style by hand, don't run prettier on it. The example source-aliases `@dawcore/wam`, so Task 1's change is picked up with no package rebuild.

- [ ] **Step 1: Add CSS for inert rows and the section header**

In the `<style>` block, directly after the `.library-entry .vendor` rule (~line 106), add:

```css
    .library-entry.inert {
      cursor: default;
      opacity: 0.45;
    }
    .library-entry.inert:hover { border-left-color: #333; }
    .library-section {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin-top: 8px;
    }
```

- [ ] **Step 2: Partition and group the render loop**

Replace the body of the library click handler's success path — everything from `libraryEl.textContent = '';` after the warnings log (~line 491) through the end of the `for (const entry of entries)` loop (~line 514) — with:

```javascript
        libraryEl.textContent = '';

        // The community registry categorizes every entry (Effect, Modulation,
        // Instrument, MIDI, Video). Instrument/MIDI/Video plugins have no
        // audio input, so createWamInstance would reject them — render them
        // dimmed and inert instead of letting every click fail. Entries with
        // no category data (other registries) are assumed insertable; the
        // URL input above loads anything directly as the escape hatch, and
        // descriptor validation at load time remains the real gate.
        const isInsertable = (entry) =>
          !entry.category ||
          entry.category.length === 0 ||
          entry.category.includes('Effect') ||
          entry.category.includes('Modulation');

        const renderEntry = (entry, insertable) => {
          const row = document.createElement('div');
          row.className = insertable ? 'library-entry' : 'library-entry inert';
          row.title = entry.description || entry.url;

          const name = document.createElement('span');
          name.className = 'name';
          name.textContent = entry.name;
          row.appendChild(name);

          if (entry.vendor) {
            const vendor = document.createElement('span');
            vendor.className = 'vendor';
            vendor.textContent = entry.vendor;
            row.appendChild(vendor);
          }

          if (insertable) {
            row.addEventListener('click', () =>
              addWam(document.getElementById('target').value, entry.url));
          }
          libraryEl.appendChild(row);
        };

        const insertable = entries.filter(isInsertable);
        const inert = entries.filter((entry) => !isInsertable(entry));
        for (const entry of insertable) renderEntry(entry, true);
        if (inert.length > 0) {
          const header = document.createElement('div');
          header.className = 'library-section';
          header.textContent =
            "instruments / midi / video — can't be inserted into an effects chain";
          libraryEl.appendChild(header);
          for (const entry of inert) renderEntry(entry, false);
        }
```

This replaces the old per-row comment ("Instrument-only plugins are rejected at load time...") — the new comment above `isInsertable` covers it. Keep the surrounding `try`/`catch` and the warnings `addLog` line untouched.

- [ ] **Step 3: Verify in the browser**

Run: `pnpm example:dawcore-wam` (from repo root; Vite prints the actual port — nominally 5175 — and the cwd it serves).

In the browser: click "Browse community library" and confirm:
1. Effect/Modulation entries (e.g. "Simple Distortion", "Envelope Follower") list first and still insert on click — pick one and confirm it appears in the rack with no error in the log.
2. A dimmed section follows with the header text, containing entries like "Synth-101", "Piano Roll", "Function Sequencer".
3. Clicking a dimmed row does nothing (no log error, no cursor pointer).
4. Pasting an instrument URL (e.g. `https://www.webaudiomodules.com/community/plugins/burns-audio/synth101/index.js`) into the URL input still produces the existing clear `hasAudioInput=false` log error — the escape hatch and safety net are intact.

- [ ] **Step 4: Commit**

From the repo root:

```bash
git add examples/dawcore-wam/index.html
git commit -m "feat: group non-insertable plugins in dawcore-wam community picker"
```

---

### Task 3: Finish the branch

**Files:**
- Delete: `docs/specs/2026-06-11-wam-library-category-grouping-design.md`
- Delete: `docs/plans/2026-06-11-wam-library-category-grouping.md`

- [ ] **Step 1: Full verification**

From the repo root:

```bash
pnpm lint
cd packages/dawcore-wam && npx vitest run && pnpm typecheck && cd ../..
```

Expected: lint clean, all package tests pass, no type errors.

- [ ] **Step 2: Remove working docs (project convention: spec/plan don't merge)**

```bash
git rm docs/specs/2026-06-11-wam-library-category-grouping-design.md docs/plans/2026-06-11-wam-library-category-grouping.md
git commit -m "docs: remove wam-library-category-grouping working docs"
```

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/wam-library-category-grouping
```

Then open a PR against `main` titled `feat: category-aware WAM community library picker`. The description is the durable record — summarize: the registry's `category` field now passes through `fetchWamLibrary` (boundary-validated like `keywords`), and the example picker renders Instrument/MIDI/Video entries (17 of 58) dimmed and inert under a section header instead of letting clicks fail with `hasAudioInput=false` errors; descriptor validation and the URL input remain the safety net and escape hatch. Include a test plan listing the vitest run and the four browser checks from Task 2 Step 3.

**Do not merge** — wait for explicit approval.
