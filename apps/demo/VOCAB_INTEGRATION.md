# UJM Vocabulary Build Integration

## Overview

Integrated `@openuji/vocab-build` into the demo app to automatically generate semantic web vocabularies for the User Journey Map specification.

## What Was Set Up

### 1. Vocabulary Source Files

Created two vocabulary definitions in `apps/demo/vocab/`:

#### **ujm-core.jsonld** (Core Namespace)

- **Namespace**: `https://ujm.specs.openuji.org/ns#`
- **Classes**: `Journey`, `Step`, `Transition`
- **Properties**: `start`, `steps`, `transitions`, `from`, `to`, `label`, `description`
- **Status**: Editor's Draft (ED)

#### **ujm-ui.jsonld** (UI Namespace)

- **Namespace**: `https://ujm.specs.openuji.org/ui#`
- **Classes**: `NodePosition`, `EdgeStyle`, `CanvasViewport`
- **Properties**: `position`, `x`, `y`, `style`, `color`, `width`, `zoom`
- **Status**: Editor's Draft (ED)

### 2. Build Scripts

Added to `apps/demo/package.json`:

```json
{
  "scripts": {
    "vocab:core": "vocab-build build -i vocab/ujm-core.jsonld -o public/vocab -m core --mode ED",
    "vocab:ui": "vocab-build build -i vocab/ujm-ui.jsonld -o public/vocab -m ui --mode ED",
    "vocab:build": "pnpm vocab:core && pnpm vocab:ui",
    "prebuild": "pnpm vocab:build" // Runs automatically before astro build
  },
  "dependencies": {
    "@openuji/vocab-build": "^0.1.0"
  }
}
```

### 3. Generated Outputs

Vocabularies are built to `public/vocab/` (served by Astro):

```
public/vocab/
├── ns/
│   ├── index.html        # Core vocab documentation
│   └── ns.ttl            # Core Turtle/RDF
├── ui/
│   ├── index.html        # UI vocab documentation
│   └── ui.ttl            # UI Turtle/RDF
├── contexts/
│   ├── core.jsonld       # Core JSON-LD context
│   └── ui.jsonld         # UI JSON-LD context
├── ED/
│   ├── core/
│   │   └── index.html    # Core Editor's Draft
│   └── ui/
│       └── index.html    # UI Editor's Draft
└── _redirects            # Netlify redirects
```

## Usage

### Manual Build

```bash
cd apps/demo

# Build both vocabularies
pnpm vocab:build

# Build individually
pnpm vocab:core
pnpm vocab:ui
```

### Automatic Build

Vocabularies are **automatically built** when running:

```bash
pnpm build  # prebuild hook runs vocab:build first
```

### Development

During development, vocabularies are served from `public/vocab/`:

```bash
pnpm dev
```

**Access with explicit filenames** (Astro dev server requirement):

- http://localhost:4321/vocab/ns/index.html
- http://localhost:4321/vocab/ui/index.html
- http://localhost:4321/vocab/contexts/core.jsonld
- http://localhost:4321/vocab/contexts/ui.jsonld

⚠️ **Dev Mode Note**: Astro's dev server requires explicit file paths. `/vocab/ns/` (directory) will return 404. Use `/vocab/ns/index.html` instead.

## Vocabulary Access

Once deployed, vocabularies will be accessible at:

- **Core namespace**: `https://ujm.specs.openuji.org/ns`
- **Core context**: `https://ujm.specs.openuji.org/contexts/core.jsonld`
- **Core Turtle**: `https://ujm.specs.openuji.org/ns/ns.ttl`
- **UI namespace**: `https://ujm.specs.openuji.org/ui`
- **UI context**: `https://ujm.specs.openuji.org/contexts/ui.jsonld`
- **UI Turtle**: `https://ujm.specs.openuji.org/ui/ui.ttl`

## Publishing Technical Report Snapshots

To create an immutable TR version:

1. **Update vocabulary source**:

   ```json
   {
     "status": "TR",
     "version": "1.0.0",
     "module": "core",
     ...
   }
   ```

2. **Build TR snapshot**:

   ```bash
   vocab-build build \
     -i vocab/ujm-core.jsonld \
     -o public/vocab \
     -m core \
     --mode TR \
     -v 1.0.0
   ```

3. **Commit and deploy**: TR snapshots are immutable and will be at:
   - `https://ujm.specs.openuji.org/TR/core/1.0.0/`

## Verification

✅ **Build successful**:

```
🏗️  Building vocabulary...
   Input: vocab/ujm-core.jsonld
   Module: core
   Mode: ED

✅ Build successful!

Generated files:
   - public/vocab/ns/index.html
   - public/vocab/ns/ns.ttl
   - public/vocab/contexts/core.jsonld
   - public/vocab/ED/core/index.html
```

✅ **Both vocabularies built**:

- Core vocabulary (10 terms)
- UI vocabulary (10 terms)

## Next Steps

1. **Configure custom domain**: Point `ujm.specs.openuji.org` to demo app
2. **Add vocab links to spec**: Reference vocabularies from specification documents
3. **Set up CI/CD**: Automate vocabulary publishing on git tags
4. **Create TR workflows**: Document process for releasing versioned snapshots

## Files Created

- [apps/demo/vocab/ujm-core.jsonld](./vocab/ujm-core.jsonld)
- [apps/demo/vocab/ujm-ui.jsonld](./vocab/ujm-ui.jsonld)
- [apps/demo/vocab/README.md](./vocab/README.md)

## Files Modified

- [apps/demo/package.json](./package.json) - Added scripts and dependency
