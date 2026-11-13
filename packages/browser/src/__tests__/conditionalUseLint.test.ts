// #771: `react-hooks/rules-of-hooks` reports a conditional read made with the
// older context hook and not a conditional `use()`. The `no-restricted-syntax` rule in the root
// `eslint.config.mjs` reports the forms below. This runs the real config over
// each snippet as if it were a file of this package.
//
// What the rule cannot see: a `use()` reached through another name
// (`const read = use`) or as `React.use()`, and a function named `use` that is
// not React's (it is reported too).
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

describe('lint: every use() at the top level (#771)', () => {
  for (const [name, body] of Object.entries(REPORTED)) {
    it(`reports use() in ${name}`, async () => {
      expect(await conditionalUseReports(body)).toBe(1);
    });
  }
  for (const [name, body] of Object.entries(ALLOWED)) {
    it(`allows use() in ${name}`, async () => {
      expect(await conditionalUseReports(body)).toBe(0);
    });
  }
});
