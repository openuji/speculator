# @openuji/bikeshed-migrate

Bikeshed importer package for Speculator-oriented pipelines.

This package now has two paths:

- Primary: `importBikeshedSpec()` (Bikeshed source + rendered HTML -> semantic IR)
- Legacy: `migrate()` (Bikeshed source -> Markdown), kept for compatibility only

## Primary pipeline (`importBikeshedSpec`)

```ts
import { importBikeshedSpec } from '@openuji/bikeshed-migrate';

const result = await importBikeshedSpec(bsSource, {
  renderer, // BikeshedRenderer
  // optional: renderedHtml, boilerplateResolver, includeGeneratedIndexes
});
```

### What it does

1. Extracts metadata, biblio, and resource blocks (`<style>`, `<script>`) from `index.bs`
2. Resolves boilerplate from metadata (`Group`, `Status`) via resolver abstraction
3. Renders Bikeshed source to HTML through `BikeshedRenderer`
4. Parses rendered HTML and selects semantic regions (`<main>`, optional abstract/status)
5. Normalizes Bikeshed output (remove chrome/self-links/scripts/index UI)
6. Imports normalized HTML into semantic IR (Document/Section/Paragraph/IDL/Algorithm/etc.)

## CLI

```bash
# Legacy markdown migration path
bikeshed-migrate ./index.bs --out ./out

# New HTML importer path (writes semantic-ir.json + rendered index.html)
bikeshed-migrate ./index.bs --semantic-ir --out ./out

# Override Docker image/command used for Bikeshed rendering
bikeshed-migrate ./index.bs --semantic-ir --docker-image ghcr.io/speced/bikeshed:latest --docker-command docker
```

The default renderer image is `openuji/bikeshed-renderer:latest`. If it is missing,
the CLI auto-builds it from `docker/bikeshed-renderer/Dockerfile` on first run.

### Key outputs

- `result.document` semantic IR (`Document` root)
- `result.regions.main|abstract|status` selected + normalized HTML and region IR blocks
- `result.metadata`, `result.biblio`, `result.resources`
- `result.config` (metadata/biblio mapped to Speculator config)
- `result.rendererDiagnostics` + pipeline diagnostics

## Module ownership

- `src/extract/*` source-owned extraction (metadata, biblio, resources)
- `src/boilerplate-resolver.ts` metadata -> boilerplate integration
- `src/renderer/*` renderer abstraction and docker adapter
- `src/html/*` parse/select/normalize Bikeshed-rendered HTML
- `src/import/*` semantic HTML -> IR importer
- `src/import-bikeshed-spec.ts` top-level orchestration

## Legacy markdown path

`migrate()` remains exported for backward compatibility. It is no longer the preferred import architecture.
New work should use `importBikeshedSpec()` and avoid adding Markdown/MDX-specific transforms.
