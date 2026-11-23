// Run with: node --test website/src/remark/nextInstallTag.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import remarkNextInstallTag, { tagInstallCommands } from './nextInstallTag.ts';

test('tags each of our packages on an npm install line', () => {
  assert.equal(
    tagInstallCommands(
      'npm install @waveform-playlist/browser @waveform-playlist/core tone @dnd-kit/react'
    ),
    'npm install @waveform-playlist/browser@next @waveform-playlist/core@next tone @dnd-kit/react'
  );
});

test('tags @dawcore packages and the pnpm, yarn and bun forms', () => {
  assert.equal(
    tagInstallCommands('pnpm add @dawcore/components'),
    'pnpm add @dawcore/components@next'
  );
  assert.equal(tagInstallCommands('yarn add @dawcore/wam'), 'yarn add @dawcore/wam@next');
  assert.equal(tagInstallCommands('bun add @dawcore/midi'), 'bun add @dawcore/midi@next');
  assert.equal(tagInstallCommands('npm i @dawcore/transport'), 'npm i @dawcore/transport@next');
});

test('leaves a comment after the command alone', () => {
  assert.equal(
    tagInstallCommands('npm install @dawcore/transport  # pairs with @waveform-playlist/core'),
    'npm install @dawcore/transport@next  # pairs with @waveform-playlist/core'
  );
});

test('leaves a package that already names a version or tag', () => {
  assert.equal(
    tagInstallCommands('npm install @waveform-playlist/browser@16 @dawcore/components@next'),
    'npm install @waveform-playlist/browser@16 @dawcore/components@next'
  );
});

test('leaves lines that are not install commands', () => {
  const lines = [
    "import { Waveform } from '@waveform-playlist/browser';",
    "import { effects } from '@waveform-playlist/browser/tone';",
    'npm install tone@next',
    'pnpm build',
  ].join('\n');
  assert.equal(tagInstallCommands(lines), lines);
});

test('changes only the install lines of a multi-line block', () => {
  assert.equal(
    tagInstallCommands(
      '# Native Web Audio\nnpm install @dawcore/transport\n# or\nnpm install @waveform-playlist/playout tone'
    ),
    '# Native Web Audio\nnpm install @dawcore/transport@next\n# or\nnpm install @waveform-playlist/playout@next tone'
  );
});

test('the plugin rewrites code and inline code, not prose', () => {
  const tree = {
    type: 'root',
    children: [
      { type: 'code', lang: 'bash', value: 'npm install @waveform-playlist/annotations' },
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Run npm install @waveform-playlist/midi, or ' },
          { type: 'inlineCode', value: 'npm install @waveform-playlist/midi' },
        ],
      },
    ],
  };
  remarkNextInstallTag()(tree);
  assert.equal(tree.children[0].value, 'npm install @waveform-playlist/annotations@next');
  const paragraph = tree.children[1].children ?? [];
  assert.equal(paragraph[0].value, 'Run npm install @waveform-playlist/midi, or ');
  assert.equal(paragraph[1].value, 'npm install @waveform-playlist/midi@next');
});
