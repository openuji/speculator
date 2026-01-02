# @openuji/render-respec

**Generate high-performance, ReSpec-compatible HTML from Speculator AST.**

`render-respec` is the official rendering engine for the Speculator ecosystem. It takes the semantic content from the [Speculator core](../speculator) and weaves it into the classic, trusted W3C ReSpec aesthetic—without the browser-side performance penalty.

## ✨ Features

- **Instant Static HTML**: Generates complete, SEO-friendly HTML documents at build time.
- **Classic ReSpec Look**: 100% visual parity with the standard W3C ReSpec template.
- **Integrated Diagnostics**: Automatically embeds errors and warnings from `speculator-lint` into the rendered document.
- **Hyper-Resolution**: Handles complex cross-references, TOC generation, and bibliography resolution during the render phase.

## 🚀 Usage

```typescript
import { renderRespec } from "@openuji/render-respec";

await renderRespec({
  input: "spec/index.md",
  config: "spec/config.respec.json",
  output: "dist/index.html",
});
```

## 📖 Why use this instead of standard ReSpec?

Traditional ReSpec runs in the reader's browser, which can be slow and brittle for large specifications. `render-respec` provides the same professional result but as a static asset, making your specs faster to load and easier to host anywhere.

---

Part of the [Speculator](../../README.md) ecosystem.
