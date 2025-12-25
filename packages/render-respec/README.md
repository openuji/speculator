# @openuji/render-respec

Generate ReSpec-compatible HTML from specification source files using the Speculator AST pipeline.

## Features

- **Server-Side Rendering**: Produces static HTML similar to what ReSpec would generate
- **Speculator Integration**: Uses Speculator pipeline to build AST with all indexes and resolutions
- **Diagnostics**: Integrates speculator-lint for aggregating errors and warnings in-place
- **ReSpec Compatible**: Generates HTML with 100% look and feel of classical ReSpec template
- **Markdown & HTML**: Accepts both Markdown and HTML spec source files
- **Complete Documents**: Ships complete `<html/>` documents, similar to vocab-build

## Installation

```bash
pnpm add @openuji/render-respec
```

## Usage

### Programmatic API

```typescript
import { renderRespec } from '@openuji/render-respec';

const result = await renderRespec({
    input: 'spec/index.md',
    config: 'spec/config.respec.json',
    output: 'dist/index.html',
    strict: false,
});

if (result.success) {
    console.log('Generated:', result.outputPath);
    console.log('Diagnostics:', result.diagnostics);
} else {
    console.error('Errors:', result.errors);
}
```

### CLI

```bash
# Render spec to HTML
render-respec render -i spec/index.md -c spec/config.respec.json -o dist/index.html

# Validate spec without rendering
render-respec validate -i spec/index.md -c spec/config.respec.json
```

## Configuration

Create a `config.respec.json` file that mirrors standard ReSpec configuration:

```json
{
  "specStatus": "ED",
  "shortName": "my-spec",
  "subtitle": "My Specification",
  "editors": [
    {
      "name": "Editor Name",
      "email": "editor@example.com",
      "company": "Company",
      "companyURL": "https://example.com"
    }
  ],
  "publishDate": "2025-12-25",
  "maxTocLevel": 3,
  "github": "org/repo"
}
```

### Supported Config Options

- `specStatus`: Document status (ED, FPWD, WD, CR, PR, REC, etc.)
- `shortName`: Short name for the spec
- `subtitle`: Optional subtitle
- `editors`: Array of editor objects
- `authors`: Array of author objects
- `publishDate`: Publication date (YYYY-MM-DD)
- `previousPublishDate`: Previous publication date
- `group`: Working group name
- `github`: GitHub repository (org/repo format)
- `maxTocLevel`: Maximum TOC depth (default: 3)
- `copyrightStart`: Copyright start year
- `logos`: Custom logo configurations

## How It Works

1. **Parse**: Loads spec source file (HTML or Markdown)
2. **Build AST**: Runs Speculator pipeline with transform, index, and resolve phases
3. **Lint**: Runs speculator-lint to collect diagnostics
4. **Render**: Generates ReSpec-compatible HTML with diagnostics displayed inline
5. **Output**: Writes complete HTML document

## License

MIT
