---
name: state-ownership
description: Use when designing, planning or reviewing a change in packages/ that adds, moves or shares state - a prop paired with a change callback, a provider or context value, a store or cache, engine or adapter state mirrored in React, undo history, a value two components or two packages both read or change - and when a bug looks like state reverting, a lost update, a value that is stale after loading, or two parts of the system disagreeing.
---

# State ownership

**Every piece of state has one owner. Everything else subscribes to it and
changes it by asking the owner.** (Maintainer, 2026-11-13.)

Scope: every package. It applies to a design before code, to a review, and to
a bug hunt.

## First: the owner table

Before any design text, write this table for every piece of state the change
reads or writes. It is the first thing in the design message, the plan and the
review.

| State | Stored where (EVERY place) | Who writes each place | Owner | How others change it |
| --- | --- | --- | --- | --- |

Fill "Stored where" from the code, not from the feature's description: every
`useState`, ref, field, Map and array that holds the value or a copy of it, in
React, in the engine, in an adapter and in the app. Count these as places:

- **The app's state behind a controlled prop.** `<X value={v} onChange={setV}>`
  stores the value in the app. If the library also keeps and changes it, that
  is two places.
- **A "working copy"** that is reset from a prop, or overwritten from an event.
- **A ref or a state that mirrors** another object's state.
- **A snapshot** (undo history, a drag's saved start) that captures values
  some other object owns.

Not a second place: a value computed from the owner during render, a cached
projection that is never written back, a one-way cache downstream (what an
audio adapter holds).

## A row with two places

When a row has more than one entry under "Stored where", the next message to
the maintainer is about that row and has these five parts, in this order, and
nothing after the fifth:

1. The owner table.
2. The row with two places, in a sentence: what is stored twice, and who
   writes each.
3. One sequence in which the two places disagree (next section).
4. The options, each named, with what it costs: make one place the owner and
   have the other subscribe (say which, for each candidate), or keep both for
   now and say which side wins in each order.
5. The recommendation, and the question.

The feature's own design, its API and its tests are the following message,
written for the option the maintainer chose.

This holds when the two places are older than the change. A feature that adds
a field to state with two owners gives the field two owners.

## The order of events

For every row that is written from more than one place, or across a callback,
a promise or an effect, write the sequence both ways round: A writes then B,
B writes then A. For each step say what value each place holds.

Look for a write whose value was computed earlier than it lands. A callback
that hands back a whole array or object is one: the array was built from an
older state, and storing it overwrites whatever was written in between. A
functional update does not help when the payload itself is the old whole value.

In React the order within one commit is: render, layout effects, passive
cleanups, passive effects; then async continuations and store notifications.

## After choosing an owner

- **Moving a seam is not removing it.** List every other object that still
  stores the value. If one of them writes back to the owner, there are still
  two owners.
- Ask the reviewer one question before any other: "which state here is still
  stored in two places, and which place writes back?"
- State a consumer can see changes hands: list what each consumer tree does
  before and after (root `CLAUDE.md`, "Nothing breaks is a claim about
  behaviour").

## Run it where both sides are real

A sequence that crosses React and the engine is run in a browser before it is
called correct. Unit tests with a fake adapter passed while a real page lost
rows. The probes and the dev-server rules are in root `CLAUDE.md`.

## Shapes that hold one owner

| Need | Shape | In this codebase |
| --- | --- | --- |
| Many readers, few of which care about each change | An owner object with `subscribe` / `getSnapshot`, read with `useSyncExternalStore` and a selector that returns a primitive or a cached object; changed through its methods | `ValueSource` (`packages/core/src/valueSource.ts`), `EffectsRack` (`packages/browser/src/effects/effectsRack.ts`) |
| Feedback during a gesture, one committed change at the end | A view-only preview that only the affected component follows; the owner is written once, on release; cancel clears the preview | `annotationPreview` (`packages/browser/src/providerInternals/useAnnotationState.ts`) |
| State that must survive a remount | The owner lives outside the component; no effect cleanup clears it | `EffectsRack`; root `CLAUDE.md`, "A store owned by a hook" |
| An option several components draw with | One small context, read where it is used; no prop beside it | `WaveformViewOptions` |

## Common mistakes

- Calling the app's state "the single source" while the engine keeps and edits
  a copy.
- Fixing one disagreement between two owners with a guard, a merge or a flag.
  Each closes one sequence; the next sequence needs another.
- Putting a new field on an object without asking who owns the object.
- Writing every pointer move of a drag into the owner.
- Declaring a value derived when something writes it back.
