// #771: `react-hooks/rules-of-hooks` reports a conditional read made with the
// older context hook and not a conditional `use()`. The `no-restricted-syntax` rule in the root
// `eslint.config.mjs` reports the forms below. This runs the real config over
// each snippet as if it were a file of this package.
//
// What the rule cannot see is listed above it in `eslint.config.mjs`; the main
// one is a `use()` inside a callback, which the first two NOT REPORTED cases
// below record (no lint rule reports it). It also reports any function named
// `use`, and a read inside a component that is itself defined in a branch.
import { describe, it, expect } from 'vitest';
import { ESLint } from 'eslint';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const eslint = new ESLint({ cwd: repoRoot });
const HEADER = "import React, { createContext, use } from 'react';\nconst C = createContext(0);\n";

async function conditionalUseReports(body: string): Promise<number> {
  const [result] = await eslint.lintText(HEADER + body, {
    filePath: join(repoRoot, 'packages', 'browser', 'src', 'lintSnippet.tsx'),
  });
  return result.messages.filter((message) => message.ruleId === 'no-restricted-syntax').length;
}

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
