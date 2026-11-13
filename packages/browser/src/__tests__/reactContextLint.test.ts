// #771: the lint rules for React 19 context code, run through the real root
// config. Two parts.
//
// 1. `react-hooks/rules-of-hooks` does not report a conditional `use()` (the
// first REPORTED case checks that it stays silent). The `no-restricted-syntax` rule in the root
// `eslint.config.mjs` reports the forms below. This runs the real config over
// each snippet as if it were a file of this package.
//
// What the rule cannot see is listed above it in `eslint.config.mjs`; the main
// one is a `use()` inside a callback, which the first two NOT REPORTED cases
// below record (no lint rule reports it).
//
// 2. `@eslint-react/eslint-plugin` reports the old spellings. What it does not
// report is recorded in the last block, so that a plugin update that changes
// it is noticed.
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const eslint = new ESLint({ cwd: repoRoot });
const HEADER = "import React, { createContext, use } from 'react';\nconst C = createContext(0);\n";

async function reportsOf(ruleId: string, source: string): Promise<number> {
  const [result] = await eslint.lintText(source, {
    filePath: join(repoRoot, 'packages', 'browser', 'src', 'lintSnippet.tsx'),
  });
  // A snippet that does not parse must fail the test, not count as "no report".
  expect(result.messages.filter((message) => message.fatal)).toEqual([]);
  // Errors only: a rule turned down to a warning no longer fails `pnpm lint`.
  return result.messages.filter((message) => message.ruleId === ruleId && message.severity === 2)
    .length;
}

const conditionalUseReports = (body: string) => reportsOf('no-restricted-syntax', HEADER + body);

/** Every lint error for the snippet, whatever the rule. */
async function anyReports(body: string): Promise<number> {
  const [result] = await eslint.lintText(HEADER + body, {
    filePath: join(repoRoot, 'packages', 'browser', 'src', 'lintSnippet.tsx'),
  });
  return result.messages.filter((message) => message.severity === 2).length;
}

const REPORTED: Record<string, string> = {
  'a ternary branch': 'export const A = ({ on }: { on: boolean }) => <i>{on ? use(C) : 0}</i>;',
  'the right side of &&': 'export const A = ({ on }: { on: boolean }) => <i>{on && use(C)}</i>;',
  'a call inside a ternary branch':
    'export const A = ({ on }: { on: boolean }) => <i>{on ? String(use(C)) : 0}</i>;',
  'a call on the right side of &&':
    'export const A = ({ on }: { on: boolean }) => <i>{on && String(use(C))}</i>;',
  'inside an if block':
    'export const A = ({ on }: { on: boolean }) => {\n  let v = 0;\n  if (on) {\n    v = use(C);\n  }\n  return <i>{v}</i>;\n};',
  'the else of an if':
    'export const A = ({ on }: { on: boolean }) => {\n  let v = 0;\n  if (on) v = 1;\n  else v = use(C);\n  return <i>{v}</i>;\n};',
  'after an early return':
    'export const A = ({ on }: { on: boolean }) => {\n  if (!on) return null;\n  const v = use(C);\n  return <i>{v}</i>;\n};',
  'in a loop':
    'export const A = ({ n }: { n: number }) => {\n  let v = 0;\n  for (let i = 0; i < n; i++) v += use(C);\n  return <i>{v}</i>;\n};',
  'the right side of ||': 'export const A = ({ v }: { v: number }) => <i>{v || use(C)}</i>;',
  'the right side of ??': 'export const A = ({ v }: { v?: number }) => <i>{v ?? use(C)}</i>;',
  'an else if':
    'export const A = ({ n }: { n: number }) => {\n  let v = 0;\n  if (n === 1) v = 1;\n  else if (n === 2) v = use(C);\n  return <i>{v}</i>;\n};',
  'after an early return in braces':
    'export const A = ({ on }: { on: boolean }) => {\n  if (!on) {\n    return null;\n  }\n  const v = use(C);\n  return <i>{v}</i>;\n};',
  'after a return':
    'export const useA = () => {\n  return 1;\n  // eslint-disable-next-line no-unreachable\n  use(C);\n};',
  'a for-of loop':
    'export const A = ({ rows }: { rows: number[] }) => {\n  let v = 0;\n  for (const row of rows) v += row + use(C);\n  return <i>{v}</i>;\n};',
  'a for-in loop':
    'export const A = ({ rows }: { rows: object }) => {\n  let v = 0;\n  for (const key in rows) v += key.length + use(C);\n  return <i>{v}</i>;\n};',
  'a while loop':
    'export const A = ({ n }: { n: number }) => {\n  let v = 0;\n  while (v < n) v += use(C) + 1;\n  return <i>{v}</i>;\n};',
  'a do-while loop':
    'export const A = ({ n }: { n: number }) => {\n  let v = 0;\n  do v += use(C) + 1;\n  while (v < n);\n  return <i>{v}</i>;\n};',
  'a try block':
    'export const A = () => {\n  let v = 0;\n  try {\n    v = use(C);\n  } catch {\n    v = 1;\n  }\n  return <i>{v}</i>;\n};',
  'in a switch':
    'export const A = ({ n }: { n: number }) => {\n  let v = 0;\n  switch (n) {\n    case 1:\n      v = use(C);\n  }\n  return <i>{v}</i>;\n};',
};

const ALLOWED: Record<string, string> = {
  'the top level': 'export const A = () => {\n  const v = use(C);\n  return <i>{v}</i>;\n};',
  'the test of an if':
    'export const A = () => {\n  if (use(C) !== 1) {\n    return null;\n  }\n  return <i />;\n};',
  'the test of a ternary': 'export const A = () => <i>{use(C) ? 1 : 0}</i>;',
  'a call inside the test of a ternary': 'export const A = () => <i>{String(use(C)) ? 1 : 0}</i>;',
  'the left side of ??': 'export const useA = () => use(C) ?? 1;',
  'a hook that returns the read': 'export const useA = () => use(C);',
};

// Conditional reads that no rule reports: recorded so that a change is noticed.
const NOT_REPORTED: Record<string, string> = {
  'a callback':
    'export const A = ({ rows }: { rows: number[] }) => <i>{rows.map(() => use(C))}</i>;',
  'a useMemo callback':
    "import { useMemo } from 'react';\nexport const A = () => <i>{useMemo(() => use(C), [])}</i>;",
};

describe('lint: every use() at the top level (#771)', () => {
  it('rules-of-hooks itself says nothing about a conditional use()', async () => {
    const body = Object.values(REPORTED)[0];
    expect(await reportsOf('react-hooks/rules-of-hooks', HEADER + body)).toBe(0);
    expect(await conditionalUseReports(body)).toBe(1);
  });

  for (const [name, body] of Object.entries(REPORTED)) {
    it(`reports use() in ${name}`, async () => {
      expect(await conditionalUseReports(body)).toBe(1);
    });
  }
  for (const [name, body] of Object.entries(NOT_REPORTED)) {
    it(`does not see use() in ${name}`, async () => {
      expect(await anyReports(body)).toBe(0);
    });
  }
  for (const [name, body] of Object.entries(ALLOWED)) {
    it(`allows use() in ${name}`, async () => {
      expect(await conditionalUseReports(body)).toBe(0);
    });
  }
});

const OLD_HEADER =
  "import React, { createContext, forwardRef, useContext } from 'react';\n" +
  'const FooContext = createContext(0);\n';

describe('lint: React 19 spellings (#771)', () => {
  it('reports useContext(), bare and through React', async () => {
    const body =
      'export const A = () => <i>{useContext(FooContext)}</i>;\n' +
      'export const B = () => <i>{React.useContext(FooContext)}</i>;\n' +
      'export const F = forwardRef;';
    expect(await reportsOf('@eslint-react/no-use-context', OLD_HEADER + body)).toBe(2);
  });

  it('reports <FooContext.Provider>', async () => {
    const body =
      'export const A = () => <FooContext.Provider value={1} />;\n' +
      'export const B = [useContext, forwardRef];';
    expect(await reportsOf('@eslint-react/no-context-provider', OLD_HEADER + body)).toBe(1);
  });

  it('reports forwardRef', async () => {
    const body =
      'export const A = forwardRef<HTMLDivElement>((_props, ref) => <div ref={ref} />);\n' +
      'export const B = useContext;';
    expect(await reportsOf('@eslint-react/no-forward-ref', OLD_HEADER + body)).toBe(1);
  });

  it('does not see a provider in an alias, in createElement, a Consumer, or an oddly named context', async () => {
    const body =
      'const Slot = createContext(0);\n' +
      'const Alias = FooContext.Provider;\n' +
      'export const A = () => <Alias value={1} />;\n' +
      'export const B = () => React.createElement(FooContext.Provider, { value: 1 });\n' +
      'export const C = () => <FooContext.Consumer>{(v) => <i>{v}</i>}</FooContext.Consumer>;\n' +
      'export const D = () => <Slot.Provider value={1} />;\n' +
      'export const E = [useContext, forwardRef];\n' +
      'export const Control = () => <FooContext.Provider value={1} />;';
    // Exactly the control at the end: the rule is on and the five forms above it are not seen.
    expect(await reportsOf('@eslint-react/no-context-provider', OLD_HEADER + body)).toBe(1);
  });

  it('does not see useContext or forwardRef under another name', async () => {
    const source =
      "import React, { createContext, forwardRef as wrap, useContext as read } from 'react';\n" +
      'const FooContext = createContext(0);\n' +
      'export const A = () => <i>{read(FooContext)}</i>;\n' +
      'export const B = wrap<HTMLDivElement>((_props, ref) => <div ref={ref} />);\n' +
      'export const Control = () => <i>{React.useContext(FooContext)}</i>;';
    expect(await reportsOf('@eslint-react/no-use-context', source)).toBe(1);
    expect(await reportsOf('@eslint-react/no-forward-ref', source)).toBe(0);
  });
});
