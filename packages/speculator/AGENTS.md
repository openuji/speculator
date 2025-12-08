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
  - converts Markdown → Markdown IR
  - converts HTML → DOM IR
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
A plugin may register hooks across multiple phases:
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

---

## Plugin Interface (Normative)

Each plugin exports:

- `name`
- optional `phases` with handlers
- optional `parse` handlers for HTML and/or Markdown IR

A plugin **must not** perform IO directly; it uses provided context services.

Suggested shape:

```ts
type Phase =
  | "preprocess"
  | "parse"
  | "transform"
  | "resolve"
  | "index"
  | "compute"
  | "render";

interface Plugin {
  name: string;

  order?: Partial<Record<Phase, number>>;

  preprocess?(ctx): Promise<void>;

  /**
   * Parse is a single phase.
   * The parse engine provides a normalized IR for each SourceUnit:
   * - htmlIR: DOM-like tree
   * - mdIR:  Markdown AST-like tree
   *
   * Plugins may implement either or both handlers.
   * Plugins emit Speculator AST nodes through ctx.emit().
   */
  parse?: {
    html?: (node: HtmlIRNode, ctx: ParseContext) => void;
    markdown?: (node: MdIRNode, ctx: ParseContext) => void;
  };

  transform?(ctx): Promise<void>;
  resolve?(ctx): Promise<void>;
  index?(ctx): Promise<void>;
  compute?(ctx): Promise<void>;
  render?(ctx): Promise<void>;
}
