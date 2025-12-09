# Speculator AI Development Playbook

**AST-First, 3-Stage Pipeline: Preprocess → Parse → Postprocess**

This repo extends Speculator with:

- Spec composition via includes (Markdown directive + HTML marker)
- Isomorphic FileProvider adapters
- Schema-central SpecAST with JSON outputs
- Optional ToC + heading numbering (computed views)

Three primary stages:

1. **Preprocess**: config + includes + CompositeSource
2. **Parse**: hast/mdast → SpecAST via dedicated parsers
3. **Postprocess**: transform/resolve/index/compute/render via plugins

Preserved killer features:

- JSON AST + indexes
- plugin-friendly architecture (postprocess)
- workspace/multi-spec capability

## Non-Negotiable Requirements

### Import Conventions

- Use the `#src/*` alias for internal modules.
- No `@src`, no deep `../../` chains.
- Keep TS paths and package imports aligned.

### Authoring + Composition

Supported authoring forms:

**Markdown directive:**

```markdown
:::include ./file.md
:::
```

**HTML compatibility marker:**

```html
<section
  data-include="./file.md"
  data-include-format="markdown">
</section>
```

Includes are resolved in the **Preprocess** stage, before:

- parse
- transform
- resolve
- index
- render

Authors must also be able to define sections in place without any includes.

### Must-Haves

- Preserve `sourcePos.file` for included content
- Detect include cycles
- Be deterministic across runs
- Be isomorphic via FileProvider adapters

Entrypoint may point to:

- spec content file (`format.md`/`format.html`)
- config file (`config.respec.json`)

### Optional Computed Views

Users must be able to:

- derive ToC and numbering from the AST themselves
- or use exposed helper utilities
- or enable embedding of computed fields via options

## Core Architecture Principles

### 1) AST Schema Is Central

The SpecAST JSON Schema is the single source of truth.

All of these must validate against it:

- parse output (may include unresolved marker fields allowed by schema)
- transformed AST
- resolved AST
- embedded-compute AST (if enabled)

Stricter invariants per stage are enforced via phase/stage guards in addition to schema validation.

### 2) No String-Only Include Flattening

- Do not merge included files into a single string.
- Use a CompositeSource of ordered SourceUnits.
- Parse per unit to preserve `sourcePos.file`.

### 3) Single-Responsibility Modules by Stage

**Preprocess**

- `file-provider`: IO + path resolution + canonicalization
- `include`: marker scanning + graph + cycle detection + deterministic expansion
- `preprocess`: config + include orchestration → CompositeSource

**Parse**

- `parse engine`:
  - converts Markdown → mdast / Markdown IR
  - converts HTML → hast / DOM IR
- `parser modules`:
  - convert IR (hast/mdast) → SpecAST nodes

**Postprocess**

- `transform`: structural normalization only
- `resolve`: semantic enrichment (dfn/xref/rfc2119/biblio etc.)
- `index`: derived indexes from marker nodes
- `compute`: optional derived views (ToC, numbering, etc.)
- `render`: HTML + JSON outputs
- `workspace`: multi-doc/global indexes
- `diagnostics`: cross-stage collection + reporting
- `cli`: user interface, no core logic

### 4) Deterministic Ordering

- Each stage and postprocess phase executes in a stable, defined order.
- Plugins may declare per-phase order weights (postprocess).
- No phase may reorder AST siblings unless explicitly documented by that phase contract.

## Stage 1 – Preprocess

The Preprocess stage is responsible for:

- loading config
- resolving entrypoint(s)
- scanning + expanding includes
- producing a deterministic CompositeSource of SourceUnits

### Responsibilities

**Config + Entry**

- `loadConfig` resolves and validates `config.respec.json` (if used).
- `loadEntry` resolves the entrypoint:
  - markdown or HTML spec file, or
  - config file pointing at the spec.

**FileProviders**

Provide isomorphic IO:

- `NodeFileProvider`
- `WebFileProvider`
- `MemoryFileProvider`

These are responsible for:

- path resolution + canonicalization
- reading source files (no SpecAST logic)

**Include System**

- Markdown include scanner
- HTML include scanner
- IncludeGraph with cycle detection
- deterministic expansion strategy

Outputs a CompositeSource:

```typescript
interface CompositeSource {
  units: SourceUnit[];
}

interface SourceUnit {
  id: string;           // stable logical id
  path: string;         // canonicalized path
  format: "markdown" | "html";
  content: string;      // original source text
}
```

### Determinism

- Preprocess must be deterministic for a given workspace + options.
- Includes expansion order and resulting CompositeSource are stable across runs.

## Stage 2 – Parse

The Parse stage converts the preprocessed CompositeSource into a schema-valid SpecAST using:

- a core parse engine (for IR conversion and traversal)
- parser modules that live under `src/parse/`

### Parse Engine

For each SourceUnit:

- If `format === "html"`:
  - parse to hast / HtmlIR.
- If `format === "markdown"`:
  - parse to mdast / MdIR.

The engine then walks the IR and delegates to parser modules that know how to map hast/mdast nodes to SpecAST nodes.

### Parser Modules (New Home + Naming Convention)

All code that understands hast/mdast and emits SpecAST lives in the `parse/` folder.

They are now first-class parser modules.

**Location:**

```
src/
  parse/
    HeadingsHtmlParser.ts
    HeadingsMarkdownParser.ts
    ListsHtmlParser.ts
    ListsMarkdownParser.ts
    InlinesHtmlParser.ts
    InlinesMarkdownParser.ts
    ...
```

**Naming Pattern:**

```
<TagsOrNodeTypes><Format>Parser
```

Where:

- `TagsOrNodeTypes` describes the responsibility:
  - e.g. Headings, Lists, Paragraphs, Inlines, Links, Images, Dfn, Biblio, etc.
- `Format` is:
  - `Html` for hast / HTML IR
  - `Markdown` for mdast / Markdown IR

**Examples:**

- `HeadingsHtmlParser` handles h1..h6 hast nodes.
- `HeadingsMarkdownParser` handles mdast heading nodes.
- `ListsHtmlParser` handles ul/ol/li hast nodes.
- `ListsMarkdownParser` handles mdast list and listItem.
- `InlineEmphasisHtmlParser` might handle `<em>` / `<strong>`.
- `InlineEmphasisMarkdownParser` might handle mdast emphasis / strong.

These modules:

- are not postprocess plugins
- have no IO responsibilities
- only map IR → SpecAST and attach correct `sourcePos.file`.

### Parser Module Contract (Informal)

Each parser module typically exports a registration function or object, e.g.:

```typescript
export interface HtmlParserModule {
  name: string;
  handles: HtmlTagSelector; // e.g. ["h1", "h2", "h3", "h4", "h5", "h6"]
  parse(node: HtmlIRNode, ctx: ParseContext): void;
}

export interface MarkdownParserModule {
  name: string;
  handles: MdNodeSelector; // e.g. ["heading"]
  parse(node: MdIRNode, ctx: ParseContext): void;
}
```

Where `ParseContext` provides:

- `emit(astNode)` – emit SpecAST nodes
- `sourcePos` – with correct file
- traversal helpers
- diagnostics emission (for parse-level issues)

The parse engine:

- knows about all registered parser modules
- dispatches them deterministically by:
  - IR node kind (tag name or mdast type)
  - module order (stable, deterministic)

### Parse Goals

- One logical parse stage.
- Equivalent semantics in HTML and Markdown yield equivalent SpecAST shapes.
  - Example: HTML `<h2>` and Markdown `##` both become `BlockHeading`.
- Unclaimed IR nodes:
  - may be converted to a neutral/fallback node (e.g. `BlockHtml`) if enabled
  - or generate diagnostics
  - behavior must be deterministic and test-covered.

## Stage 3 – Postprocess

The Postprocess stage takes the parsed SpecAST and runs the classical pipeline:

- **transform** – structural normalization only
- **resolve** – semantic enrichment / linking
- **index** – derived indexes
- **compute** – optional derived views (ToC, numbering, etc.)
- **render** – HTML + JSON outputs

Postprocess is implemented via plugins, using a unified plugin contract (minus the moved parse responsibilities).

### Postprocess Phases

**transform**

- normalize structure
- no semantic resolution
- may fold simple wrappers, flatten containers, etc.

**resolve**

- bind dfns/xrefs
- resolve references (biblio, RFC2119, etc.)

**index**

- build derived indexes from marker nodes:
  - dfn index
  - xref index
  - biblio index
  - etc.

**compute**

- ToC
- heading numbering
- other derived views
- may optionally embed results into AST or return alongside it

**render**

- render SpecAST to:
  - HTML
  - JSON AST
  - (optionally) other formats

### Plugin Interface (Normative – Postprocess Only)

Each plugin exports:

- `name`
- optional per-phase handlers for postprocess phases only

```typescript
type PostprocessPhase =
  | "transform"
  | "resolve"
  | "index"
  | "compute"
  | "render";

interface Plugin {
  name: string;

  /**
   * Deterministic ordering within each phase.
   * Lower numbers run earlier.
   */
  order?: Partial<Record<PostprocessPhase, number>>;

  transform?(ctx: TransformContext): Promise<void> | void;
  resolve?(ctx: ResolveContext): Promise<void> | void;
  index?(ctx: IndexContext): Promise<void> | void;
  compute?(ctx: ComputeContext): Promise<void> | void;
  render?(ctx: RenderContext): Promise<void> | void;
}
```

**Notes:**

- No plugin may handle hast/mdast directly.
- All HTML/Markdown parsing happens in `parse/` modules.
- Plugins operate only on SpecAST + indexes + diagnostics + workspace services.
- Plugins must not perform IO directly; they use provided context services.

### Deterministic Plugin Ordering

- Plugins run in a stable order within each phase.
- Order is derived from:
  - explicit `order[phase]` weight (lower = earlier)
  - name-based tiebreaker if needed
- Conflicts (two plugins modifying the same structure) must be:
  - deterministic
  - documented per phase
- No plugin may reorder sibling nodes unless explicitly part of that phase's contract.

## Diagnostics

Diagnostics are collected across all stages.

`DiagnosticCollector` is shared by:

- preprocess
- parse
- postprocess (all phases)

Diagnostics include:

- severity (info | warning | error)
- message
- sourcePos (including correct file)
- optional code + related locations

CLI supports:

- `--fail-on-error`
- optional `--fail-on-warning`

## Pipeline Overview

Full pipeline, mapped onto the 3 stages:

**Preprocess**

- `loadConfig`
- `loadEntry`
- `preprocessIncludes` → CompositeSource

**Parse**

- core parse engine:
  - text content → hast/mdast (HTML/Markdown IR)
- parser modules (`parse/`):
  - hast/mdast → SpecAST

**Postprocess**

- `transform` (plugins)
- `resolve` (plugins)
- `index` (plugins)
- `compute` (plugins, optional)
- `render` (plugins)

## Phase / Stage Guards

Stage-specific validators enforce stricter rules than the schema alone:

- `validateParseAst`
  - allows unresolved fields where schema permits
  - verifies baseline structural invariants after Parse
- `validateResolvedAst`
  - verifies semantic binding requirements after resolve
- `validateIndexedOutputs`
  - ensures consistency between AST and derived indexes

Guards must be:

- deterministic
- side-effect free
- covered in unit tests

## Deliverables

### A) AST + Schema

- `spec-ast.schema.json`
- generated TS types from schema
- runtime validators/guards
- AST JSON serializer

### B) FileProviders (Preprocess)

- `NodeFileProvider`
- `WebFileProvider`
- `MemoryFileProvider`

### C) Includes (Preprocess)

- Markdown include scanner
- HTML include scanner
- IncludeGraph
- cycle detection
- deterministic expansion
- CompositeSource output

### D) Parse

- core parse engine (HTML/Markdown → hast/mdast IR)
- parser module registry
- `parse/` folder with `<TagsOrNodeTypes><Format>Parser` modules
- deterministic dispatch over IR nodes

### E) Postprocess Pipeline

Phases implemented via plugins:

- `transform`
- `resolve`
- `index`
- `compute` (optional)
- `render`

### F) CLI

- `speculator build`
- `speculator ast`
- `speculator lint`
- `speculator debug:includes`

Flags for compute modes:

- `--compute-toc none|return|embed`
- `--compute-numbering none|return|embed`

### G) Diagnostics

- shared `DiagnosticCollector`
- cross-stage collection and reporting

### H) Tests

- unit tests for scanners, graph, determinism (Preprocess)
- unit tests for parser modules (Parse; HTML and Markdown)
- unit tests for resolve/index/compute/render hooks per plugin (Postprocess)
- integration tests using `MemoryFileProvider`
- schema validation tests for each pipeline stage
- stage guard tests for parse vs resolved vs indexed invariants
- tests for mixed authoring:
  - in-place sections + includes in same document
  - cross-file dfn/xref and citations

## Definition of Done

- Both include syntaxes work.
- Includes are resolved before parse/resolve/index.
- Cycle detection produces actionable diagnostics.
- Preprocess is deterministic.
- SpecAST schema is canonical and enforced in CI.
- **Parse**:
  - is a single stage over CompositeSource
  - is implemented via `parse/` modules, not postprocess plugins
  - Parser modules can emit equivalent AST nodes from:
    - HTML hast
    - Markdown mdast
- Users can:
  - compute ToC/numbering externally
  - or enable return/embed modes via compute
- AST nodes from included files have correct `sourcePos.file`.
- Indexers work regardless of compute mode.
- CLI supports entry + config + compute flags.
- Diagnostics are emitted incrementally per stage.
- Stage/phase guards enforce parse vs resolved vs indexed invariants.
- Tests cover:
  - determinism
  - cross-file semantics
  - HTML+Markdown parity for core node kinds.