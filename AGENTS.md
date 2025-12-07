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
- parser output
- transformed AST
- resolved AST
- embedded-compute AST (if enabled)


### 2) No String-Only Include Flattening
Do not merge included files into a single string.
Use a `CompositeSource` of ordered `SourceUnit`s.
Parse per unit to preserve `sourcePos.file`.

### 3) Single Responsibility Modules
- file-provider: IO + path resolution + canonicalization
- include: marker scanning + graph + cycle detection + deterministic expansion
- preprocess: config + include orchestration -> CompositeSource
- parse: SourceUnit -> semantic AST
- transform: structural normalization only
- resolve: semantic enrichment (dfn/xref/rfc2119/biblio)
- index: derived indexes
- compute: optional derived views
- render: HTML + JSON outputs
- workspace: multi-doc/global indexes
- cli: user interface, no core logic

### 4) Phase-Aware Plugins
Plugins declare one pipeline phase:
`preprocess | parse | transform | resolve | index | compute | render`

Include resolution is core infrastructure, not a plugin.

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
4) parse
5) transform
6) resolve
7) index
8) compute (optional)
9) render

### E) CLI
- `speculator build`
- `speculator ast`
- `speculator lint`
- `speculator debug:includes`
Flags for compute modes:
- `--compute-toc none|return|embed`
- `--compute-numbering none|return|embed`

### F) Tests
- unit tests for scanners, graph, determinism, compute helpers
- integration tests using MemoryFileProvider
- schema validation tests for each pipeline stage

---

## Definition of Done

1) Both include syntaxes work.
2) Includes are resolved before parse/resolve/index.
3) Cycle detection produces actionable diagnostics.
4) Preprocess is deterministic.
5) AST schema is canonical and enforced in CI.
6) Parser emits semantic AST.
7) Users can:
   - compute ToC/numbering externally
   - or enable return/embed modes
8) AST nodes from included files have correct `sourcePos.file`.
9) Indexers work regardless of compute mode.
10) CLI supports entry + config + compute flags.

---

## Review Checklist

- Does every public output validate against the AST schema?
- Is include expansion deterministic and cycle-safe?
- Do included nodes preserve `sourcePos.file`?
- Are modules SRP-clean?
- Are compute helpers pure and side-effect free?
- Is the plugin phase contract respected?
- Do tests cover mixed authoring:
  - in-place sections + includes in same document?
