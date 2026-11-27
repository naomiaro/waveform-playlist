---
name: mutation-testing
description: Use when checking that new or changed tests can fail - breaking a guarded line by hand, running mutants in bulk with the probes/mutate scripts, or deciding what a surviving, refused or hanging mutant means.
---

# Mutation checks

Every new regression test is seen to fail with the line it guards broken, before the first review.

## Running mutants

- **Mutation checks in bulk:** a small script that copies the file, applies one `perl -0pi -e 's/…/…/'`, refuses to continue when the file did not change (a mutation that silently did not apply looks like a test that caught nothing), runs the one test file, prints the failing test names and restores the file. 33 mutations were run this way on #756; two showed an assertion gap (a flag that was never cleared, and a state value not tied to `isRecording`). Check `git status --short` for leftovers afterwards.
- **Mutation runs: give each mutant only the test files that can see its source file** (40 s per mutant with 16 files, 3 s with the right 2 to 8; `probes/mutate687.py`, `BY_FILE`). Stop a run with `pkill -INT -f mutate…` so the `finally` restores the file; a background command is killed after 10 minutes without that.
- **The mutation runner over the full browser suite takes about 35 s per mutant** (54 mutants, 30 minutes, in the background). Nothing else may edit source or run e2e against a dev server meanwhile: the server hot-reloads the mutated file. A mutant reported as REFUSED means prettier re-wrapped the line; fix the string and rerun it.
- **A mutant that removes a loop guard never ends**, and vitest cannot time out a synchronous loop. Give the mutation runner a per-mutant timeout that kills vitest and counts the mutant as killed (`probes/mutate689.py`), and check `pgrep -f vitest` afterwards: a hung worker stays at 100% CPU.
- **A documentation agent reads source: do not run a mutation script while it works.** Start the mutation run when the agent has returned, and read source yourself with `git show HEAD:<file>` while mutants are being applied.
- **A mutant that does not compile is not a kill.** An arrow body replaced with an object literal (`(t) => cond ? t : {…}` → `(t) => {…}`) parses as a block: vitest prints "Transform failed" and "no tests", and the runner counts a non-zero exit as a kill (#930). Wrap a literal in parentheses, and read the failing test names: a kill with no name is a broken mutant.
- **A pattern that matches two identical lines mutates the first.** `perl -0pi -e 's/…/…/'` without `/g` changes the first match only; on #919 a "survivor" was the other copy of the line. Anchor on the indentation or the line before, and print `diff <backup> <file>` to see which line changed.

## Reading the result

- **A loop bound needs a boundary test of its own.** Tests that check every tick over a long range let `pix <= widthX` and `pix < widthX - 1` survive (#722 round 1). Add one input whose last tick is exactly at the bound (10 s at 48 px/s: none at 480) and one a pixel inside it (10.001 s: one at 480).
- **A REFUSED mutant is not a killed one, and a fixture can hide the property.** A pattern that matches twice is refused: make it unique and run it again. On #847 "states share the track object" passed with the memo removed, because the clip sat at tick 0, which a ppqn conversion leaves unchanged; and a rename test never looked at the old id. Choose fixture values the code under test changes. A survivor on a line no test can reach was a dead line or a redundant guard each time: remove it.
- **A mutant must be able to work before its survival means anything, and a survivor is first a question about the code.** On #849 a "per id, not per object" mutant stored its value in a microtask, after the pass that would have read it: it survived for that reason alone. Of nine other survivors two were redundant code (a dev freeze of states that `_emit` freezes anyway; a guard before a call that already guards) and were REMOVED; the rest were missing assertions. Ask "would anything observable differ?" before writing a test for a survivor.
- **A mutant must break the property through the path the test reads.** Two survivors on #770 added a duplicate name to a file the entry point does not export; the guard is about entry points. And a survivor on a line no caller can reach (a guard behind a disabled button) means the line goes, not that a test is missing.
- **A surviving mutant is not "equivalent" until the path is named.** On #782 the one survivor of 67 (`restAt` clearing the range end) was reported as equivalent; the review found a path where the line mattered. For each survivor write down every caller that reaches the line and what it would see without it, or report it as an untested line.
- **A mutant must break the property, not resemble the old code.** On #685 "the root renders again" did not make the parts render, because React skips a child whose element is the same object. The real break was two lines together (re-create the elements and drop the memo). When a mutant survives, ask what the test's subject actually depends on.
- **An option whose only test asserts that it was NOT used is untested.** On #853 `useCreateArrangement`'s one test with `loadSource` asserted that nothing was fetched, so deleting `...options` passed every test (found by the final reviewer, who ran the suite against a copy of the hook). For each option of a new function, one test in which the option changes the outcome, and the mutant "the option is never passed".
