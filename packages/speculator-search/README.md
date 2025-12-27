# @openuji/speculator-search

Search index builder for Speculator with content mapping and navigation support.

## Features

- 🔍 **Full-text search indexing** - Extract searchable content from Speculator AST
- 🎯 **Content-addressable navigation** - Map search results to rendered locations
- 🏷️ **In-memory search IDs** - Generate hierarchical IDs without polluting AST
- 🚀 **Static build-time generation** - No Node server needed at runtime
- 🔌 **Pluggable architecture** - Extends Speculator via plugins
- 🎨 **Client-side ready** - Pure JavaScript search with optional FlexSearch

## Installation

```bash
pnpm add @openuji/speculator @openuji/speculator-search
```

## Quick Start

### Build-Time Index Generation

```typescript
import { speculate, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { contentIdPlugin, searchIndexPlugin, buildSearchIndex } from '@openuji/speculator-search';
import fs from 'fs/promises';

// Run Speculator with search plugins
const result = await speculate({
  entry: 'spec/index.md',
  plugins: [
    ...corePlugins,
    contentIdPlugin,
    searchIndexPlugin()
  ],
  fileProvider: new NodeFileProvider()
});

// Build search index
const searchIndex = buildSearchIndex(result.workspace);

// Save as static JSON
await fs.writeFile(
  'public/search-index.json',
  JSON.stringify(searchIndex)
);
```

### Client-Side Search

```html
<script>
  // Load search index
  const response = await fetch('/search-index.json');
  const index = await response.json();
  
  // Simple search
  const results = index.documents
    .flatMap(doc => doc.entries)
    .filter(entry => entry.plainText.includes('query'));
  
  // Navigate to result
  window.location.href = results[0].url; // e.g., "/docs/api#intro"
</script>
```

## How It Works

### 1. Content ID Plugin

Generates hierarchical search IDs **in-memory only** (does NOT modify AST):

```typescript
// AST remains unchanged:
{ type: 'paragraph', id: 'my-para', children: [...] }

// Plugin creates internal mapping:
contentIdMap.set('intro.p-2', {
  searchId: 'intro.p-2',
  canonicalId: 'my-para',  // Original ID preserved
  node: paragraphRef
});
```

### 2. Search Index Plugin

Extracts searchable text and builds index:

```json
{
  "version": "1.0.0",
  "documents": [{
    "documentId": "spec/index.md",
    "route": "/docs/api",
    "title": "API Documentation",
    "entries": [{
      "searchId": "intro.p-2",
      "text": "The API provides...",
      "plainText": "the api provides",
      "anchor": "#intro",
      "context": {
        "sectionTitle": "Introduction",
        "nodeType": "paragraph"
      }
    }]
  }]
}
```

### 3. Client Navigation

Search results link to existing canonical IDs:

```
User searches "API" → Result: { anchor: "#intro", route: "/docs/api" }
Click result → Navigate to "/docs/api#intro"
Browser scrolls to <section id="intro">
Optional: Highlight "API" text within section
```

## Configuration

Create `config.search.json`:

```json
{
  "routing": {
    "strategy": "pattern",
    "pattern": "/docs/{shortName}",
    "fallback": "/docs/index"
  },
  "search": {
    "mode": "raw",
    "filters": {
      "enabled": true,
      "fields": ["documentType", "sectionType"]
    }
  }
}
```

## API

### Plugins

#### `contentIdPlugin`

Generates hierarchical search IDs without modifying AST.

```typescript
import { contentIdPlugin } from '@openuji/speculator-search';

const plugins = [...corePlugins, contentIdPlugin];
```

#### `searchIndexPlugin(config?)`

Collects searchable content from documents.

```typescript
import { searchIndexPlugin } from '@openuji/speculator-search';

const plugins = [
  contentIdPlugin,
  searchIndexPlugin({
    configPath: 'config.search.json'
  })
];
```

### Builders

#### `buildSearchIndex(workspace, options?)`

Builds final search index from workspace AST.

```typescript
const searchIndex = buildSearchIndex(result.workspace, {
  mode: 'raw',
  includeSourcePos: false
});
```

### Types

- `SearchIndex` - Complete search index structure
- `DocumentSearchData` - Search data for a single document
- `SearchEntry` - Individual searchable content entry
- `SearchContext` - Context information for search results

## Examples

See `/Users/zavalit/Projects/openuji/speculator/apps/demo` for complete working example.

## License

MIT
