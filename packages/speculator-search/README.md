# @openuji/speculator-search

**Build-time search indexing for serverless, instant navigation.**

`speculator-search` extracts searchable content from [Speculator documents](../speculator) and generates static JSON indexes. This allows spec readers to find what they need instantly, without requiring a backend search server.

## 🔍 Features

- **Full-Text Indexing**: Extracts text from paragraphs, headings, and definitions.
- **Context-Aware Results**: Search results include section titles and node types for better relevance.
- **Zero Runtime Dependencies**: The generated index is pure JSON, compatible with any client-side search library (like FlexSearch).
- **Hierarchical IDs**: Automatically generates stable navigation anchors even if the source document lacks IDs.

## 🚀 Usage

### 1. Build the Index (Node.js)

```typescript
import { buildSearchIndex } from "@openuji/speculator-search";

const searchIndex = buildSearchIndex(workspace);
await fs.writeFile("public/search-index.json", JSON.stringify(searchIndex));
```

### 2. Search (Browser)

```javascript
const response = await fetch("/search-index.json");
const index = await response.json();

// Direct search across all documents
const results = index.documents
  .flatMap((doc) => doc.entries)
  .filter((e) => e.plainText.includes("your query"));
```

---

Part of the [Speculator](../../README.md) ecosystem.
