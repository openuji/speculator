# @openuji/vocab-build

Generate publishable semantic web vocabulary assets from JSON-LD schema source files.

## Features

- 🎯 **Dual Mode Support**: Editor's Draft (ED) and Technical Report (TR) versioned snapshots
- 📦 **Complete Asset Generation**: JSON-LD contexts, Turtle/RDF vocabularies, and HTML documentation
- 🔒 **TR Immutability**: Prevents accidental overwrites of published snapshots
- 🎨 **Modern HTML Output**: Responsive, accessible vocabulary pages with copy-to-clipboard
- 🔄 **Redirect Manifests**: Support for Netlify, Cloudflare, and generic JSON formats
- ✅ **Full Validation**: Zod-based schema validation with detailed error messages

## Installation

```bash
npm install @openuji/vocab-build
# or
pnpm add @openuji/vocab-build
```

## CLI Usage

### Build Command

Build vocabulary assets in Editor's Draft mode:

```bash
vocab-build build \
  --input vocab.core.jsonld \
  --out dist \
  --module core \
  --mode ED
```

Build a Technical Report snapshot:

```bash
vocab-build build \
  --input vocab.core.jsonld \
  --out dist \
  --module core \
  --mode TR \
  --version 1.0.0
```

### Validate Command

Validate a vocabulary source file:

```bash
vocab-build validate --input vocab.core.jsonld
```

### Release Command

Convenience command for releasing a TR version:

```bash
vocab-build release --input vocab.core.jsonld
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --input <path>` | Path to vocab source file (required) | - |
| `-o, --out <dir>` | Output directory | `dist` |
| `-m, --module <core\|ui>` | Module name (required) | - |
| `--mode <ED\|TR>` | Build mode (required) | - |
| `-v, --version <semver>` | Version for TR mode (x.y.z) | - |
| `-f, --force` | Overwrite existing TR snapshot | `false` |
| `-b, --base-url <url>` | Base URL for deployment | - |
| `-r, --redirects <type>` | Redirect type (none\|netlify\|cloudflare\|json) | `netlify` |
| `-s, --strict` | Fail on unknown fields | `false` |

## Library API

```typescript
import { buildVocab, validateVocab } from '@openuji/vocab-build';

const result = await buildVocab({
  input: 'vocab.core.jsonld',
  output: 'dist',
  module: 'core',
  mode: 'ED',
});

if (result.success) {
  console.log('Generated files:', result.files);
} else {
  console.error('Errors:', result.errors);
}
```

## Input Format

Vocabulary source files use an extended JSON-LD format:

```json
{
  "module": "core",
  "namespace": "https://ujm.specs.openuji.org/ns#",
  "docBase": "https://ujm.specs.openuji.org/ns",
  "title": "User Journey Map Core Vocabulary",
  "description": "Core vocabulary for defining user journey maps",
  "status": "ED",
  "updated": "2025-12-23",
  "terms": [
    {
      "id": "Journey",
      "kind": "Class",
      "label": "Journey",
      "comment": "A complete user journey"
    },
    {
      "id": "start",
      "kind": "Property",
      "label": "start",
      "comment": "The starting step",
      "domain": "https://ujm.specs.openuji.org/ns#Journey",
      "range": "https://ujm.specs.openuji.org/ns#Step"
    }
  ],
  "context": {
    "Journey": {
      "@id": "https://ujm.specs.openuji.org/ns#Journey",
      "@type": "@id"
    }
  }
}
```

### Required Fields

- `module`: `"core"` or `"ui"`
- `namespace`: Base IRI ending in `#`
- `docBase`: Base document IRI without `#`
- `title`, `description`: Human-readable strings
- `status`: `"ED"` or `"TR"`
- `terms`: Array of term definitions

### ED-Specific

- `updated`: ISO date string (YYYY-MM-DD)

### TR-Specific

- `version`: SemVer string (x.y.z)

### Term Definition

- `id`: Fragment name (valid identifier)
- `kind`: `"Class"` or `"Property"`
- `label`, `comment`: Human-readable strings
- `domain`, `range`: Optional IRIs
- `deprecated`: Optional boolean
- `seeAlso`: Optional array of URLs

## Output Structure

### For `core` module:

```
dist/
  ns/
    index.html           # Latest HTML
    ns.ttl              # Latest Turtle
  contexts/
    core.jsonld         # Latest JSON-LD context
  ED/
    core/
      index.html        # Editor's Draft
  TR/
    core/
      1.0.0/
        index.html      # TR snapshot
        context.jsonld
        ns.ttl
  _redirects           # Optional redirect manifest
```

### For `ui` module:

```
dist/
  ui/
    index.html
    ui.ttl
  contexts/
    ui.jsonld
  ED/
    ui/
      index.html
  TR/
    ui/
      1.0.0/
        index.html
        context.jsonld
        ui.ttl
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Type check
pnpm typecheck
```

## License

MIT
