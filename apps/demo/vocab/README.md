# UJM Specification Vocabularies

This directory contains the vocabulary source files for the User Journey Map (UJM) specification.

## Vocabularies

### Core Namespace (`ujm-core.jsonld`)

**Namespace**: `https://ujm.specs.openuji.org/ns#`

Defines the core semantic model for user journey maps:
- **Classes**: `Journey`, `Step`, `Transition`
- **Properties**: `start`, `steps`, `transitions`, `from`, `to`, `label`, `description`

### UI Namespace (`ujm-ui.jsonld`)

**Namespace**: `https://ujm.specs.openuji.org/ui#`

Defines visual and interaction elements for journey map editors:
- **Classes**: `NodePosition`, `EdgeStyle`, `CanvasViewport`
- **Properties**: `position`, `x`, `y`, `style`, `color`, `width`, `zoom`

## Building Vocabularies

The vocabularies are automatically built before the demo app builds. You can also build them manually:

```bash
# Build both vocabularies
pnpm vocab:build

# Build individual vocabularies
pnpm vocab:core
pnpm vocab:ui
```

## Accessing Vocabularies in Dev Mode

### Important: Dev vs Production URLs

**In Development (`pnpm dev`):**

Astro's dev server requires explicit file paths. Use these URLs:

```
http://localhost:4321/vocab/ns/index.html       # Core vocabulary HTML
http://localhost:4321/vocab/ui/index.html       # UI vocabulary HTML
http://localhost:4321/vocab/contexts/core.jsonld # Core JSON-LD context
http://localhost:4321/vocab/contexts/ui.jsonld   # UI JSON-LD context
http://localhost:4321/vocab/ns/ns.ttl           # Core Turtle/RDF
http://localhost:4321/vocab/ui/ui.ttl           # UI Turtle/RDF
```

⚠️ **Note**: `/vocab/ns/` (with trailing slash) will return 404 in dev mode. You must use the full filename `/vocab/ns/index.html`.

**In Production (after deployment):**

Standard web servers will resolve directory URLs automatically:

```
https://your-domain.com/vocab/ns/        # ✅ Works (resolves to index.html)
https://your-domain.com/vocab/ui/        # ✅ Works (resolves to index.html)
```

## Generated Outputs

Vocabularies are generated to `public/vocab/` and deployed with the demo app:

```
public/vocab/
├── ns/
│   ├── index.html        # Core vocab HTML page
│   └── ns.ttl            # Core vocab Turtle/RDF
├── ui/
│   ├── index.html        # UI vocab HTML page
│   └── ui.ttl            # UI vocab Turtle/RDF
├── contexts/
│   ├── core.jsonld       # Core JSON-LD context
│   └── ui.jsonld         # UI JSON-LD context
└── ED/
    ├── core/
    │   └── index.html    # Core Editor's Draft
    └── ui/
        └── index.html    # UI Editor's Draft
```

## Publishing Technical Reports

To publish an immutable TR snapshot:

1. Update the vocabulary source file:
   - Change `"status": "ED"` to `"status": "TR"`
   - Add `"version": "1.0.0"` (SemVer)
   - Remove `updated` field

2. Build the TR snapshot:
   ```bash
   vocab-build build -i vocab/ujm-core.jsonld -o public/vocab -m core --mode TR -v 1.0.0
   ```

3. The TR snapshot will be immutable at:
   ```
   public/vocab/TR/core/1.0.0/
   ```

## Access Points

### Development (localhost)

While running `pnpm dev`:

- **Core HTML**: `http://localhost:4321/vocab/ns/index.html`
- **Core context**: `http://localhost:4321/vocab/contexts/core.jsonld`
- **Core Turtle**: `http://localhost:4321/vocab/ns/ns.ttl`
- **UI HTML**: `http://localhost:4321/vocab/ui/index.html`
- **UI context**: `http://localhost:4321/vocab/contexts/ui.jsonld`
- **UI Turtle**: `http://localhost:4321/vocab/ui/ui.ttl`

### Production (deployed)

Once deployed, vocabularies will be accessible at:

- **Core namespace**: `https://ujm.specs.openuji.org/vocab/ns/`
- **Core context**: `https://ujm.specs.openuji.org/vocab/contexts/core.jsonld`
- **UI namespace**: `https://ujm.specs.openuji.org/vocab/ui/`
- **UI context**: `https://ujm.specs.openuji.org/vocab/contexts/ui.jsonld`

> **Note**: Before deploying to production, update the namespace URIs in `vocab/ujm-core.jsonld` and `vocab/ujm-ui.jsonld` from `localhost:4321` to your actual domain.
