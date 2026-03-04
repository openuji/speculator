# @openuji/solospec

Static HTML renderer for Speculator AST without Astro.

`@openuji/solospec` is designed for CI-friendly single-document publishing flows.

## Install

```bash
pnpm add @openuji/solospec @openuji/speculator
```

## Vite Plugin (Package-Owned Theme)

`solospecPlugin` injects everything required for rendering:

- spec HTML wrapped in `.solospec-root`
- bikeshed theme CSS (from `@openuji/solospec`, no host CSS import)
- runtime mode handling (`system | light | dark`) with persisted preference
- optional built-in mode switcher

```ts
import { defineConfig } from "vite";
import { solospecPlugin } from "@openuji/solospec/vite";

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: "spec/index.md",
      configPath: "spec/config.json",
      theme: {
        name: "bikeshed",
      },
    }),
  ],
});
```

Theme config contract:

```ts
type SolospecThemeSettings = {
  name?: "bikeshed";
};
```

Defaults and schema are exported:

- `DEFAULT_SOLOSPEC_THEME_SETTINGS`
- `SOLOSPEC_THEME_SETTINGS_SCHEMA`
- `resolveSolospecThemeSettings(...)`

## Client Runtime

If a document contains diagram nodes like Mermaid or LikeC4, `solospec` will automatically inject standard ES module `import` scripts into the final HTML.
Consumers are expected to process the resulting HTML file through a bundler like Vite. The target application must install the peer dependencies:

```bash
pnpm add -D vite @likec4/core likec4 mermaid react react-dom
```

## Theme Tokens (DTCG + Tailwind v4)

Theme design values live in DTCG token files, grouped per theme:

```text
tokens/
  themes/
    bikeshed/
      color.json
      spacing.json
      typography.json
      radius.json
      shadow.json
      motion.json
      size.json
```

Token build output is generated into:

```text
src/styles/generated/themes/<theme>.tokens.css
```

Theme CSS files import their generated token file first, then Tailwind v4:

```css
@import "../generated/themes/bikeshed.tokens.css";
@import "tailwindcss";
```

Commands:

```bash
pnpm run tokens       # generate token css from DTCG files
pnpm run build:styles # regenerate tokens and compile theme css
```
