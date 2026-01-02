# Speculator

**The AST-first specification compiler: ReSpec logic with build-time performance, Markdown support, and developer-grade linting.**

Speculator is a modern reimagining of ReSpec. While traditional ReSpec relies on complex browser-side execution, Speculator moves the "intelligence" to a build-time pipeline. It treats specifications like code—parsing them into a semantic AST that can be validated, indexed, and transformed before being rendered to high-performance static HTML.

## 🚀 Key Features

- **AST-First Architecture**: Your spec is a structured data model, not just a DOM tree.
- **Markdown & HTML Parity**: Write in Markdown for developer ergonomics or HTML for full control; get identical results.
- **Build-Time Performance**: Instant-load, SEO-friendly static outputs with no "loading" spinners.
- **Developer-Grade Linting**: Prevent circular dependencies and concept redefinitions across complex spec hierarchies.
- **Static Search**: Generate full-text search indexes at build time for instant, serverless navigation.

## 📦 Project Structure

This monorepo contains several specialized packages that form the Speculator ecosystem:

| Package                                                    | Purpose                                                                                 |
| :--------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| [`@openuji/speculator`](packages/speculator)               | **Core Engine**: The AST-first parser, indexer, and resolution pipeline.                |
| [`@openuji/render-respec`](packages/render-respec)         | **Renderer**: Generates 1:1 ReSpec-compatible HTML from the Speculator AST.             |
| [`@openuji/speculator-lint`](packages/speculator-lint)     | **Linter**: Enforces semantic and structural rules across your specification workspace. |
| [`@openuji/speculator-search`](packages/speculator-search) | **Search**: Extracts searchable content and builds static search indexes.               |
| [`@openuji/vocab-build`](packages/vocab-build)             | **Vocab Tool**: Automates the generation of vocabulary definitions and reference docs.  |

## 🛠️ Getting Started

To explore the Speculator engine in action, check out the [demo application](apps/demo).

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run the demo
cd apps/demo
pnpm dev
```

## 📖 Why Speculator?

Current specification tools often force a choice between ease of authoring (Markdown) and semantic richness (ReSpec/Bikeshed). Speculator bridges this gap by providing a formal pipeline that extracts the deep semantics of a technical specification while allowing authors to use modern, low-friction tooling.

---

Developed by [OpenUJI](https://github.com/openuji). Licensed under MIT.
