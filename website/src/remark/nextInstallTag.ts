/**
 * Remark plugin for the `next` docs build: on every install command in a code
 * block or inline code, our packages get the `@next` dist-tag, so a reader of
 * the next docs installs the prereleases those docs describe.
 *
 *   npm install @waveform-playlist/browser tone
 *   → npm install @waveform-playlist/browser@next tone
 *
 * The Markdown itself stays plain (`npm install @waveform-playlist/browser`)
 * and the stable build leaves it alone. Registered in docusaurus.config.ts
 * only when DOCS_CHANNEL is `next`. Test: node --test website/src/remark/
 */

const INSTALL_COMMAND =
  /\b(?:npm\s+(?:install|i|add)|pnpm\s+(?:add|install|i)|yarn\s+add|bun\s+add)\s/;

// A package of ours that names no version or tag yet. The lookahead keeps
// `@waveform-playlist/browser@16` and subpaths like `@waveform-playlist/browser/tone`.
const OWN_PACKAGE = /(@(?:waveform-playlist|dawcore)\/[a-z0-9][a-z0-9-]*)(?![\w@/-])/g;

const NEXT_TAG = '@next';

const tagInstallLine = (line: string): string => {
  if (!INSTALL_COMMAND.test(line)) {
    return line;
  }
  // Only the command is rewritten: a shell comment after it may name a package too.
  const commentAt = line.search(/\s#/);
  const command = commentAt === -1 ? line : line.slice(0, commentAt);
  const comment = commentAt === -1 ? '' : line.slice(commentAt);
  return command.replace(OWN_PACKAGE, `$1${NEXT_TAG}`) + comment;
};

export const tagInstallCommands = (text: string): string =>
  text.split('\n').map(tagInstallLine).join('\n');

interface MarkdownNode {
  type: string;
  value?: string;
  children?: MarkdownNode[];
}

const CODE_NODE_TYPES = new Set(['code', 'inlineCode']);

const visit = (node: MarkdownNode, onNode: (node: MarkdownNode) => void): void => {
  onNode(node);
  node.children?.forEach((child) => visit(child, onNode));
};

export default function remarkNextInstallTag() {
  // A remark transformer edits the tree it is given in place; that is the API.
  return (tree: MarkdownNode): void => {
    visit(tree, (node) => {
      if (CODE_NODE_TYPES.has(node.type) && typeof node.value === 'string') {
        node.value = tagInstallCommands(node.value);
      }
    });
  };
}
