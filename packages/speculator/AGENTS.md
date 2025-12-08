---
# Speculator AI Development Playbook (AST-First + Optional Compute)

This repo extends Speculator with:
- Spec composition via includes (Markdown directive + HTML marker)
- Isomorphic FileProvider adapters
- Schema-central AST with JSON outputs
- Optional ToC + heading numbering (computed views)
- Modular, phase-aware pipeline
- Preserved killer features:
  - JSON AST + indexes
  - plugin-friendly architecture
  - workspace/multi-spec capability

---

## Non-Negotiable Requirements

### Import Conventions
- Use the `#src/*` alias for internal modules (no `@src`, no deep relative `../../` chains). Keep TS `paths` + package `imports` aligned.

### Authoring + Composition
Supported authoring forms:
1) Markdown directive:
   :::include ./file.md :::
2) HTML compatibility marker:
   <section data-include="./file.md" data-include-format="markdown"></section>

Includes are resolved in a **load/preprocess** stage BEFORE:
- parse
- transform
- resolve
- index
- render

Authors must also be able to define sections **in place** without any includes.

### Must-Haves
- Preserve `sourcePos.file` for included content
- Detect include cycles
- Be deterministic across runs
- Be isomorphic via `FileProvider` adapters
- Entrypoint may point to:
  - spec content file (format.md/format.html)
  - config file (config.respec.json)

### Optional Computed Views
Users must be able to:
- derive ToC and numbering from the AST themselves
- or use exposed helper utilities
- or enable embedding of computed fields via options

---

## Core Architecture Principles

### 1) AST Schema Is Central
The AST JSON Schema is the single source of truth.
All of these must validate against it:
- parser output (may include unresolved marker fields allowed by schema)
- transformed AST
- resolved AST
- embedded-compute AST (if enabled)

Stricter invariants per stage are enforced via **phase guards** in addition to schema validation.

### 2) No String-Only Include Flattening
Do not merge included files into a single string.
Use a `CompositeSource` of ordered `SourceUnit`s.
Parse per unit to preserve `sourcePos.file`.

### 3) Single Responsibility Modules
- file-provider: IO + path resolution + canonicalization
- include: marker scanning + graph + cycle detection + deterministic expansion
- preprocess: config + include orchestration -> CompositeSource
- parse-engine:
  - converts Markdown -> Markdown IR
  - converts HTML -> DOM IR
  - provides a unified traversal/dispatch surface
- parse-dispatch:
  - runs plugins over IR to emit schema-valid AST nodes
- transform: structural normalization only
- resolve: semantic enrichment (dfn/xref/rfc2119/biblio etc.)
- index: derived indexes from marker nodes
- compute: optional derived views
- render: HTML + JSON outputs
- workspace: multi-doc/global indexes
- diagnostics: cross-phase collection + reporting
- cli: user interface, no core logic

### 4) Unified Plugin Contract
There is a **single plugin interface**.
Any plugin may register hooks across multiple phases:
`preprocess | parse | transform | resolve | index | compute | render`

Plugins may also register parse handlers for:
- HTML tags (single or grouped)
- Markdown constructs
- Shared “semantic” patterns that appear in both

No AST node kind is privileged by core code; if a node kind is produced, it is because a plugin emitted it.

### 5) Deterministic Ordering
- Each phase executes hooks in a stable order.
- Plugins may declare per-phase order weights.
- If two plugins target the same IR pattern, conflict resolution is deterministic and documented.
- No phase hook may reorder AST siblings unless explicitly documented by that phase contract.

---

## Plugin Interface (Normative)

Each plugin exports:
- `name`
- optional per-phase handlers
- optional parse handlers for HTML and/or Markdown IR

A plugin **must not** perform IO directly; it uses provided context services.

Suggested shape:

```ts
type Phase =
  | "parse"
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
  order?: Partial<Record<Phase, number>>;

  /**
   * Parse is a single phase.
   * The parse engine provides a normalized IR per SourceUnit:
   * - htmlIR: DOM-like tree (when input is HTML)
   * - mdIR:  Markdown-AST-like tree (when input is Markdown)
   *
   * Plugins may implement either or both handlers.
   * Plugins emit Speculator AST nodes through ctx.emit().
   */
  parse?: {
    html?: (node: HtmlIRNode, ctx: ParseContext) => void;
    markdown?: (node: MdIRNode, ctx: ParseContext) => void;
  };

  transform?(ctx: TransformContext): Promise<void>;
  resolve?(ctx: ResolveContext): Promise<void>;
  index?(ctx: IndexContext): Promise<void>;
  compute?(ctx: ComputeContext): Promise<void>;
  render?(ctx: RenderContext): Promise<void>;
}
```

Parse context guarantees:
- `sourcePos.file` is correct per SourceUnit
- stable traversal order
- deterministic plugin dispatch
- ability to emit diagnostics
- ability to attach stable parse metadata if needed for later phases

---

## Parse Model (Single-Phase, Dual-Format)

### Goals
- One parse phase.
- Plugins can build AST nodes from:
  - HTML tags (e.g., `p`, `em`, `strong`, `img`, `h1..h6`, `dfn`, `a`, etc.)
  - Markdown constructs (paragraphs, emphasis, headings, links, inline code, etc.)
- Equivalent semantics in HTML and Markdown should yield equivalent AST shapes.

### Mechanism
1) The parse engine converts each SourceUnit into:
   - `HtmlIR` for HTML sources
   - `MdIR` for Markdown sources
2) A unified dispatcher walks the IR.
3) Plugins match IR nodes and call:
   - `ctx.emit(astNode)`
4) If no plugin matches an IR node:
   - the parse engine may either:
     - emit an agreed fallback node (e.g., `BlockHtml`) **only if enabled**
     - or produce a diagnostic
   - this behavior must be deterministic and test-covered.

### Tag Grouping
- A single plugin may claim a tag group:
  - `h1..h6` -> `BlockHeading`
  - `ul/ol/li` -> list nodes
- A single plugin may claim a shared semantic role:
  - Markdown emphasis + HTML `<em>` -> `InlineEmphasis`

---

## Deliverables

### A) AST + Schema
- `spec-ast.schema.json`
- generated TS types from schema
- runtime validators/guards
- AST JSON serializer

### B) FileProviders
- NodeFileProvider
- WebFileProvider
- MemoryFileProvider

### C) Includes
- Markdown include scanner
- HTML include scanner
- IncludeGraph
- cycle detection
- deterministic expansion
- CompositeSource output

### D) Pipeline
Phases:
1) loadConfig
2) loadEntry
3) preprocessIncludes
4) parse (single-phase, plugin-driven, HTML+Markdown IR)
5) transform
6) resolve
7) index
8) compute (optional)
9) render

### E) Phase Guards
Stage-specific validators that enforce stricter rules than schema alone:
- `validateParseAst`
  - allows unresolved fields where schema permits
  - verifies baseline structural invariants
- `validateResolvedAst`
  - verifies semantic binding requirements after resolve
- `validateIndexedOutputs`
  - ensures consistency between AST and indexes

Guards must be:
- deterministic
- side-effect free
- covered in unit tests

### F) CLI
- `speculator build`
- `speculator ast`
- `speculator lint`
- `speculator debug:includes`

Flags for compute modes:
- `--compute-toc none|return|embed`
- `--compute-numbering none|return|embed`

### G) Diagnostics
- `DiagnosticCollector` shared across all phases
- diagnostics include:
  - severity (`info|warning|error`)
  - message
  - `sourcePos`
  - optional code + related locations
- CLI supports:
  - fail-on-error
  - optional fail-on-warning

### H) Tests
- unit tests for scanners, graph, determinism
- unit tests for plugin parse handlers (HTML and Markdown)
- unit tests for resolve/index hooks per plugin
- integration tests using MemoryFileProvider
- schema validation tests for each pipeline stage
- phase guard tests for parse vs resolved invariants
- tests for mixed authoring:
  - in-place sections + includes in same document
  - cross-file dfn/xref and citations

---

## Definition of Done

1) Both include syntaxes work.
2) Includes are resolved before parse/resolve/index.
3) Cycle detection produces actionable diagnostics.
4) Preprocess is deterministic.
5) AST schema is canonical and enforced in CI.
6) Parse is a single phase and is plugin-driven.
7) Plugins can emit equivalent AST nodes from:
   - HTML tags
   - Markdown constructs
8) Users can:
   - compute ToC/numbering externally
   - or enable return/embed modes
9) AST nodes from included files have correct `sourcePos.file`.
10) Indexers work regardless of compute mode.
11) CLI supports entry + config + compute flags.
12) Diagnostics are emitted incrementally per phase.
13) Phase guards enforce parse vs resolved invariants.
14) Tests cover:
   - determinism
   - cross-file semantics
   - HTML+Markdown parity for core node kinds.

---

## Review Checklist

- Does every public output validate against the AST schema?
- Do parse and resolved outputs pass their respective phase guards?
- Is include expansion deterministic and cycle-safe?
- Do included nodes preserve `sourcePos.file`?
- Is parse truly single-phase with no hidden "core vs extension" split?
- Are HTML and Markdown semantics converging into the same AST shapes?
- Are plugin conflicts resolved deterministically?
- Are compute helpers pure and side-effect free?
- Do tests cover mixed authoring:
  - in-place sections + includes?
  - cross-file dfn/xref?
  - citations + biblio?

---
