---
name: translatable-strings
description: Use when adding or changing a React component in packages/ that draws or announces text (a label, a button's text, a tooltip, an aria-label, a placeholder, an option in a select, a formatted readout), when working on issue #808, or when asked whether the library can be translated or works with an i18n framework.
---

# Translatable strings

The library owns no translation framework. Every string a component draws or
announces can be supplied by the app; the default is the English text.

Scope: the React packages. The web components in `packages/dawcore` have no
decided mechanism yet (#808).

## The order a string is resolved in

1. **The control's own prop**, when the app passed one.
2. **The app's entry in the messages catalogue.**
3. **The English default.**

Both mechanisms exist on purpose (maintainer, 2026-11-13): the catalogue gives
an app one place for all strings, the prop overrides a single control.

## The prop for each kind of string

| String | Prop |
| --- | --- |
| Visible label or button text | `children` |
| Tooltip | `title` |
| Accessible name with no visible text | `aria-label` |
| Text built from a value ("120 BPM", "Track 3"), option texts of a select included | a format function prop that takes the value, e.g. `formatTempo(tempo)`, `formatRate(rate)` |

A symbol or a number format is a string too (`×`, the decimal point in `0.5`):
it goes through the same format function. State the English default in the
prop's JSDoc.

A control in `ui-components` often has a bound wrapper of the same name in
`browser` or `annotations`. The wrapper takes the same string props and passes
them on; without that the app cannot reach them.

Template: `packages/annotations/src/components/DownloadAnnotationsButton.tsx`
(`children` and `title`, English defaults in the destructuring).

Never build a sentence by joining translated pieces: word order differs
between languages. One string per message, with the value passed to a format
function.

## The catalogue

Before using it, find it: `git grep -n 'Messages' -- 'packages/*/src/index.ts*'`.

- **If it exists:** read the default through it, add the new key to the
  default English table, and keep the prop as the override.
- **If it does not exist yet:** give the prop an English default, and post a
  comment on #808 with one line per string: the file and line, the English
  text, the prop. Do not invent a catalogue or its name.

## Rules that travel with this

- Ids come from `useId()`; no literal `id=` or `htmlFor=`.
- Do not change an English default in passing: e2e specs and consumers' tests
  find controls by it (`getByRole(..., { name, exact: true })`).
- A new prop or catalogue key is a doc surface: `llm-reference.md`, the
  component's API page, and the package README if it names the component.
- Development warnings and thrown errors are not translated.

## Audit: find strings the app cannot replace

Run from the repository root.

```bash
# Literal attribute values
git grep -nE '(aria-label|title|placeholder|alt|label)="[^"]*[A-Za-z][^"]*"' -- \
  'packages/*.tsx' ':!packages/dawcore*' ':!*__tests__*' ':!*.stories.tsx' ':!*.test.tsx'

# Literal JSX text on one line
git grep -nE '>[^<>{}=;()]*[A-Za-z]{2}[^<>{}=;()]*</' -- \
  'packages/*.tsx' ':!packages/dawcore*' ':!*__tests__*' ':!*.stories.tsx' ':!*.test.tsx'
```

Every hit is a finding: a literal written where it is drawn. A string that is
the default of a prop (`title = 'Download'`) matches neither grep.

The greps do not see: JSX text on its own line, an attribute given as an
expression (`title={'…'}`, a ternary), strings held in arrays or objects
(select options, menu items, shortcut descriptions), template literals,
strings without letters, and `.ts` files. Read those by hand: selects, menus,
dialogs, and any `description:` or `label:` field. Example the greps miss:
`TIME_FORMAT_OPTIONS` in `packages/ui-components/src/components/TimeFormatSelect.tsx`.
