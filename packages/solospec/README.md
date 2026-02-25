# @openuji/solospec

Static HTML renderer for Speculator AST without Astro.

`@openuji/solospec` is designed for CI-friendly single-document publishing flows.

## Install

```bash
pnpm add @openuji/solospec @openuji/speculator
```

## API

### `renderDocument`

```ts
import { renderDocument } from "@openuji/solospec";

await renderDocument({
  entry: "spec/index.md",
  configPath: "spec/config.json",
  output: "index.html",
  options: {
    client: {
      likec4Workspace: "spec/diagrams",
    },
  },
});
```

### `renderAst`

```ts
import { renderAst } from "@openuji/solospec";

const { html } = await renderAst({
  workspace,
  documentId: "my-spec",
  options: {
    metadata: {
      rowOrder: ["status", "editors", "authors"],
    },
  },
});
```

## CLI

```bash
speculator-render \
  --entry spec/index.md \
  --config spec/config.json \
  --out index.html \
  --likec4-workspace spec/diagrams
```

## Client Runtime

If a document contains diagram nodes like Mermaid or LikeC4, `solospec` will automatically inject standard ES module `import` scripts into the final HTML.
Consumers are expected to process the resulting HTML file through a bundler like Vite. The target application must install the peer dependencies:

```bash
pnpm add -D vite @likec4/core likec4 mermaid react react-dom
```

## Architecture

See [`ARCHITECTURE.md`](./ARCHITECTURE.md).
