---
title: Bikeshed Theme
description: Capabilities of the built-in Bikeshed theme in Solospec.
---

The **Solospec** renderer comes with a built-in `bikeshed` theme out of the the box. This theme aims to replicate and modernize the classic W3C/Bikeshed specification aesthetics.

## Migrating from Bikeshed

If you have an existing specification authored using [Bikeshed](https://speced.github.io/bikeshed/), Speculator provides a seamless one-time migration tool to convert your `.bs` files into a Speculator-compatible workspace.

By migrating, you gain access to Speculator's fast, AST-first build pipeline and Solospec renderer, eliminating the need to ever run python-based Bikeshed tools again.

## Using `@openuji/bikeshed-migrate`

The `@openuji/bikeshed-migrate` tool converts a single `index.bs` file into:

- **`index.md`** — The specification content rewritten in Speculator-compatible Markdown.
- **`config.json`** — The document metadata extracted from your Bikeshed `<pre class='metadata'>` blocks. Boilerplate data for copyright and logo also lands here.
- **`includes/`** — Generated boilerplate files for sections that can be explicitly included (`abstract.md`, `status.md`, and `conformance.md`).

### Getting Started

You can perform an in-place migration directly from your terminal using `npx`:

```bash
# Migrate in-place (writes index.md + config.json adjacent to your index.bs)
npx @openuji/bikeshed-migrate index.bs --out ./solospec --init

cd solospec
npm install

# Optional: install mermaid for diagram support
npm install mermaid

# Run the development server
npm run dev

# Lint the specification
npm run lint

# Build the specification
npm run build

# Preview the built specification
npx serve dist
```

### What gets transformed?

1. **Metadata block (`<pre class='metadata'>`)**: Extracts variables like `Title`, `Shortname`, `Status`, `ED`, `TR`, `Editor` and maps them exactly to Speculator's `config.json`.
2. **Bibliography block (`<pre class=biblio>`)**: Converted into JSON elements under `respec.localBiblio` in the config.
3. **Content (`index.md`)**:
   - WebIDL `<xmp class="idl">` blocks are hoisted to standard fenced code blocks.
   - `<h1>`-`<h6>` tags are transformed into standard markdown headers.
   - Algorithms `<div algorithm="x">` are mapped to `<section data-algorithm="x">`.
   - Native bikeshed elements like `[[!REF]]`, `[=term=]`, and `{{Interface}}` are preserved for Speculator's parsers to process seamlessly.

## Vite Configuration

When setting up your specification in a static Vite project, you configure the Solospec renderer via the `solospecPlugin` in your `vite.config.ts`. Here are the available options and common configurations.

### Basic Setup

```typescript
import { defineConfig } from "vite";
import { solospecPlugin } from "@openuji/solospec/vite";

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: "./index.md",
      configPath: "./config.json",
      theme: {
        name: "bikeshed",
      },
    }),
  ],
});
```

### Configuring LikeC4

If your specification includes `<likec4-view>` tags and diagrams, you must tell the `solospecPlugin` where your LikeC4 workspace is located so it can compute and bundle the diagram dumps. Pass the `client.likec4Workspace` explicitly to your `options`:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: "./index.md",
      options: {
        client: {
          likec4Workspace: "./src/likec4", // Path to your LikeC4 source files
        },
      },
      theme: {
        name: "bikeshed",
      },
    }),
  ],
});
```

### Customizing Code Highlighting Theme

By default, Solospec uses `github-light` and `github-dark` themes for Shiki code highlighting. You can optionally override this by providing `codeHighlightTheme` within your `theme` settings:

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: "./index.md",
      theme: {
        name: "bikeshed",
        codeHighlightTheme: {
          light: "min-light",
          dark: "nord", // Any valid Shiki theme name
        },
      },
    }),
  ],
});
```
