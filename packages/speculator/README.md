# Speculator

AST-first specification parser and indexer with schema-central architecture.

Speculator transforms specification documents (Markdown or HTML) into structured AST and semantic indexes. It does **not** render output - that responsibility belongs to separate tools. Speculator provides optional JSON serialization of the AST and indexes for consumption by renderers, linters, or other processors.

## Schema Architecture

The AST JSON Schema (`schema/spec-ast.schema.json`) is the single source of truth. All pipeline outputs validate against it.

### Core Node Types

| Type | Description |
|------|-------------|
| `Document` | Root container with metadata, sections, and indexes |
| `Section` | Grouping with optional heading, supports nesting |
| `Block` | Block-level: paragraph, heading, codeBlock, example, blockquote, list, table, thematicBreak, html |
| `Inline` | Inline: text, emphasis, strong, inlineCode, link, image, definition, reference, requirement, issue |

### Index Markers (Inline)

Indexes are extracted from inline markers during the post-parse `index` phase:

| Marker Type | Description | Extracted To |
|-------------|-------------|--------------|
| `definition` | Term definition (dfn) | `indexes.definitions[]` |
| `reference` | Cross-reference | `indexes.references[]` |
| `requirement` | RFC 2119 keyword | `indexes.requirements[]` |
| `issue` | Open issue/TODO | `indexes.issues[]` |
| `example` (block) | Code example | `indexes.examples[]` |

### Semantic vs Computed Boundaries

| Category | In AST | Computed | Notes |
|----------|--------|----------|-------|
| Semantic nodes | ✓ | ✗ | Core AST structure |
| Indexes | ✓ | ✗ | Extracted, not computed |
| `computed.toc` | ✓ optional | ✓ | Marked `x-computed: true` |
| `computed.headingNumbers` | ✓ optional | ✓ | Marked `x-computed: true` |
| `computed.wordCount` | ✓ optional | ✓ | Marked `x-computed: true` |

**Key Distinction:**
- **Semantic AST**: Node structure + indexes. Always valid. Use `SemanticDocument` type.
- **Full AST**: Semantic + computed fields. Use `FullDocument` type.

## TypeScript Types

Generate types from schema:

```bash
npm run generate:types
```

This generates `src/types/ast.generated.ts` with:
- All node types
- `SemanticDocument` - AST without computed fields
- `FullDocument` - AST with computed fields
- Type guards: `isDocument()`, `isSection()`, `isBlock()`, `isInline()`, etc.

## Runtime Validation

```typescript
import { validateAST, assertValidAST, ASTValidator } from './src/validation/validate';

// Quick validation
const result = validateAST(ast, 'semantic'); // or 'full'
if (!result.valid) {
  console.error(result.errors);
}

// Assertion-style (throws on failure)
assertValidAST(ast, 'semantic');

// Per-stage validation
const validator = new ASTValidator();
validator.validateAtStage(ast, 'parse');    // semantic mode
validator.validateAtStage(ast, 'transform'); // semantic mode
validator.validateAtStage(ast, 'resolve');   // semantic mode
validator.validateAtStage(ast, 'index');     // semantic mode
validator.validateAtStage(ast, 'compute');   // full mode
```

## Development

```bash
# Install dependencies
npm install

# Validate schema syntax
npm run validate:schema

# Generate TypeScript types
npm run generate:types

# Build
npm run build

# Test
npm run test
```

## Pipeline Phases

```
loadConfig → loadEntry → preprocessIncludes → parse → transform → resolve → index → (compute?)
                                                                              ↓
                                                                    Extract indexes from
                                                                    inline markers
```

The pipeline produces:
- **AST**: Structured document tree with semantic nodes
- **Indexes**: Extracted definitions, references, requirements, issues, examples
- **JSON Output**: Optional serialization of AST and indexes for external tools

## Source Position Tracking

Every node can have a `sourcePos` with:
- `file` - Canonical file path (preserves include origins)
- `line`, `column` - 1-indexed position
- `offset` - 0-indexed byte offset
- `endLine`, `endColumn`, `endOffset` - End position (optional)

```typescript
interface SourcePos {
  file: string;
  line: number;    // 1-indexed
  column: number;  // 1-indexed
  offset?: number; // 0-indexed
  endLine?: number;
  endColumn?: number;
  endOffset?: number;
}
```
