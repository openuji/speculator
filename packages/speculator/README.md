# @openuji/speculator

**AST-first specification parser and indexer with a schema-central architecture.**

Speculator is the core engine of the Speculator ecosystem. It transforms specification documents (Markdown or HTML) into a structured AST and semantic indexes. Unlike traditional tools, it does **not** render output directly—it provides the semantic foundation for renderers, linters, and other processors.

## 🏗️ Architecture: The 3-Stage Pipeline

Speculator operates on a strict three-stage pipeline to ensure determinism and semantic accuracy:

### 1. Preprocess (Discovery & Composition)

Handles workspace discovery, configuration loading, and spec composition.

- **Workspace Discovery**: Automatically finds specifications using directory shorthands (e.g., `spec/docs/`) or glob patterns (e.g., `spec/**/*.md`).
- **Composition**: Resolves includes (both Markdown directives and HTML markers) into a deterministic `CompositeSource`.
- **Isomorphic IO**: Uses `FileProvider` adapters for Node.js, Web, or Memory environments.
- **Cycle Detection**: Prevents infinite include loops with actionable diagnostics.

### 2. Parse (IR Reconstruction)

Converts the `CompositeSource` into the Speculator AST. This stage is powered by dedicated parser modules that ensure Markdown and HTML parity.

- **Unified AST**: Whether source is `## Heading` or `<h2>Heading</h2>`, the output is a `BlockHeading` node.
- **Source Tracking**: Every node preserves its original `sourcePos.file`, even across multiple includes.

### 3. Postprocess (Semantic Enrichment)

A plugin-based pipeline that refines the AST:

- **Transform**: Structural normalization.
- **Resolve**: Semantic binding (connecting cross-references to definitions).
- **Index**: Extracting derived data (definitions, requirements, issues, examples).
- **Compute**: Optional generation of TOCs and heading numbering.

## 💎 Schema-Central Design

The **Speculator AST JSON Schema** is the single source of truth. All pipeline outputs are validated against this schema, ensuring that downstream tools (like `@openuji/render-respec`) can rely on a stable, typed data model.

### Core Node Types

- `Document`: Root container with metadata and indexes.
- `Section`: Hierarchical grouping with nested sections.
- `Block`: Paragraphs, headings, code blocks, lists, tables.
- `Inline`: Text, emphasis, definitions (dfn), cross-references (xref).

## 🚀 Usage

### Single Document

```typescript
import { speculate, corePlugins, NodeFileProvider } from "@openuji/speculator";

const result = await speculate({
  entry: "spec/index.md",
  plugins: [...corePlugins],
  fileProvider: new NodeFileProvider(),
});

// The result contains the Workspace AST
const document = result.workspace?.documents[0];
console.log(document?.id);
```

### Multiple Workspaces (Discovery)

```typescript
import { buildWorkspaces, corePlugins } from "@openuji/speculator";

const result = await buildWorkspaces({
  entryMap: {
    "api-group": "spec/api/", // Scans directory for index.{md,html}
    "md-group": "spec/**/*.md", // Glob discovery
  },
  plugins: [...corePlugins],
});

console.log(Object.keys(result.workspaces)); // ["api-group", "md-group"]
```

## 🛠️ Development & Playbook

### Parser Module Convention

Code that maps IR (hast/mdast) to SpecAST lives in `src/parse/` following the `<NodeTypes><Format>Parser` naming pattern (e.g., `HeadingsHtmlParser`).

### Plugin Contract

Postprocess plugins implement specific phase handlers (`transform`, `resolve`, `index`, `compute`) with deterministic ordering weights.

## 📖 Further Reading

- [Root README](../../README.md)
- [SpecAST Schema](schema/spec-ast.schema.json)
