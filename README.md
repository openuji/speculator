# Speculator

Speculator is a TypeScript-first, Markdown-friendly, theming-agnostic *spec engine* that reuses ReSpec’s good ideas but is designed to drop cleanly into modern SSGs and design system sites.




## Installation

```bash
pnpm install -D @openui/speculator linkdom
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

## Mermaid diagrams

Render [Mermaid](https://mermaid.js.org/) code blocks by enabling the
`mermaid` option when parsing Markdown:

```ts
import { parseMarkdown } from '@openui/speculator';

const md = '```mermaid\nflowchart TD;A-->B;\n```';
const html = parseMarkdown(md, { mermaid: true });
```

Configuration can be passed directly to Mermaid if needed:

```ts
parseMarkdown(md, {
  mermaid: { theme: 'forest' },
});
```


