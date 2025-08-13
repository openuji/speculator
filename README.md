# Speculator

A TypeScript library for processing ReSpec-like markup and open for intgration in any frontend framework out there


## Installation

```bash
pnpm install @openui/speculator
```


## Package Structure

```bash
speculator/
├── src/
│ ├── index.ts
│ ├── renderer.ts
│ ├── types.ts
│ └── utils/
│ ├── markdown.ts
│ └── file-loader.ts
├── tests/
│ ├── renderer.test.ts
│ └── fixtures/
│ ├── intro.md
│ ├── smooth-scroller.md
│ └── ujse.webidl
├── dist/
├── package.json
├── tsconfig.json
├── jest.config.js
├── .npmignore
└── README.md
```

## Markdown extensions

Additional [MarkdownIt](https://github.com/markdown-it/markdown-it) plugins can be
applied by passing them in `markdownOptions.extensions`:

```ts
import { parseMarkdown } from '@openui/speculator';
import anchor from 'markdown-it-anchor';

parseMarkdown('# Title', { markdownOptions: { extensions: [anchor] } });
```

Each entry can be a plugin function or a `[plugin, options]` tuple and will be
installed after the built-in ReSpec shorthand plugins.


