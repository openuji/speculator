# @openuji/vocab-build

**Generate publishable semantic web vocabulary assets from JSON-LD source files.**

`vocab-build` is a specialized tool in the Speculator ecosystem for managing machine-readable vocabularies. It bridges the gap between technical definitions and the Linked Data web, ensuring your specification's terms are both human-readable and machine-processable.

## ✨ Features

- **Dual-Mode Support**: Manage both Editor's Drafts (ED) and versioned Technical Reports (TR).
- **Multi-Format Export**: Automatically generates JSON-LD contexts, Turtle/RDF vocabularies, and HTML documentation.
- **TR Immutability**: Built-in protection to prevent accidental overwrites of published snapshots.
- **Isomorphic Ready**: Designed to work seamlessly within the [Speculator](../../README.md) pipeline.

## 🚀 Usage

### CLI

```bash
# Build vocabulary assets
vocab-build build --input vocab.jsonld --out dist --module core --mode ED
```

### Programmatic API

```typescript
import { buildVocab } from "@openuji/vocab-build";

const result = await buildVocab({
  input: "vocab.jsonld",
  output: "dist",
  module: "core",
  mode: "ED",
});
```

---

Part of the [Speculator](../../README.md) ecosystem.
