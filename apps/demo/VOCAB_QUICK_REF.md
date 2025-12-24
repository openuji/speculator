# Quick Reference: Vocabulary Build Routine

## Build Commands

```bash
# From apps/demo directory

# Build both vocabularies (manual)
pnpm vocab:build

# Build core vocabulary only
pnpm vocab:core

# Build UI vocabulary only  
pnpm vocab:ui

# Full demo app build (includes vocab build)
pnpm build
```

## Development Workflow

### 1. Update Vocabulary

Edit source files:
- `vocab/ujm-core.jsonld` - Core terms
- `vocab/ujm-ui.jsonld` - UI terms

### 2. Rebuild

```bash
pnpm vocab:build
```

### 3. View Locally

```bash
pnpm dev
```

**Dev Mode URLs** (Astro requires explicit filenames):
- http://localhost:4321/vocab/ns/index.html
- http://localhost:4321/vocab/ui/index.html
- http://localhost:4321/vocab/contexts/core.jsonld

⚠️ Note: `/vocab/ns/` alone won't work in dev - use full path `/vocab/ns/index.html`

### 4. Deploy

```bash
pnpm build
# Deploy dist/ folder
```

## Quick Additions

### Add New Term to Core Vocab

Edit `vocab/ujm-core.jsonld`:

```json
{
  "terms": [
    {
      "id": "NewTerm",
      "kind": "Class",
      "label": "New Term",
      "comment": "Description of the new term"
    }
  ]
}
```

Then rebuild:
```bash
pnpm vocab:core
```

### Add New Property

```json
{
  "id": "newProperty",
  "kind": "Property",
  "label": "new property",
  "comment": "Description",
  "domain": "https://ujm.specs.openuji.org/ns#Journey",
  "range": "http://www.w3.org/2001/XMLSchema#string"
}
```

## Release TR Version

### Step 1: Update Source

Change `vocab/ujm-core.jsonld`:

```json
{
  "status": "TR",
  "version": "1.0.0"
  // Remove: "updated": "..."
}
```

### Step 2: Build TR

```bash
vocab-build build \
  -i vocab/ujm-core.jsonld \
  -o public/vocab \
  -m core \
  --mode TR \
  -v 1.0.0
```

### Step 3: Verify

TR output at:
```
public/vocab/TR/core/1.0.0/
├── index.html
├── context.jsonld
└── ns.ttl
```

### Step 4: Deploy

Commit and push. TR snapshots are **immutable**.

## Troubleshooting

### Vocab build fails

```bash
# Validate source file
vocab-build validate -i vocab/ujm-core.jsonld
```

### Template not found

```bash
# Rebuild vocab-build package
cd ../../packages/vocab-build
pnpm build
```

### Output not updating

```bash
# Clear and rebuild
rm -rf public/vocab
pnpm vocab:build
```

## Files Structure

```
apps/demo/
├── vocab/
│   ├── ujm-core.jsonld    ← Edit here
│   ├── ujm-ui.jsonld      ← Edit here
│   └── README.md
├── public/
│   └── vocab/             ← Generated (don't edit)
│       ├── ns/
│       ├── ui/
│       ├── contexts/
│       └── ED/
└── package.json           ← Build scripts
```

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Build vocabularies
  run: |
    cd apps/demo
    pnpm vocab:build
    
- name: Build demo
  run: |
    cd apps/demo
    pnpm build
```

## URLs After Deployment

### Development
- Core vocab: `http://localhost:4321/vocab/ns/index.html`
- UI vocab: `http://localhost:4321/vocab/ui/index.html`
- Contexts: `http://localhost:4321/vocab/contexts/{core|ui}.jsonld`

### Production
Assuming deployed to `ujm.specs.openuji.org`:
- Core vocab: `https://ujm.specs.openuji.org/vocab/ns/`
- UI vocab: `https://ujm.specs.openuji.org/vocab/ui/`
- Core context: `https://ujm.specs.openuji.org/vocab/contexts/core.jsonld`
- UI context: `https://ujm.specs.openuji.org/vocab/contexts/ui.jsonld`

⚠️ **Before deploying**: Update namespace URIs in vocab source files from `localhost:4321` to production domain.
