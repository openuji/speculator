# @openuji/bikeshed-migrate

One-time migration tool that converts [Bikeshed](https://speced.github.io/bikeshed/) `.bs` specification files into the format used by [@openuji/speculator](../speculator).

Given a single `index.bs`, it produces:

- **`index.md`** — spec content in Speculator-compatible Markdown
- **`config.json`** — document metadata and bibliography for the Speculator workspace

After migration, you work exclusively with Speculator and never touch Bikeshed again.

---

## CLI

```bash
# Migrate in-place (writes index.md + config.json next to index.bs)
npx @openuji/bikeshed-migrate index.bs

# Write outputs to a specific directory (two equivalent forms)
npx @openuji/bikeshed-migrate index.bs ./output/
npx @openuji/bikeshed-migrate index.bs --out ./output/

# Preview without writing files
npx @openuji/bikeshed-migrate index.bs --dry-run

# Override the document ID in config.json
npx @openuji/bikeshed-migrate index.bs --id my-spec
```

---

## Programmatic API

```typescript
import { migrate } from '@openuji/bikeshed-migrate';
import { readFile, writeFile } from 'node:fs/promises';

const content = await readFile('index.bs', 'utf-8');
const { md, config } = await migrate(content);

await writeFile('index.md', md + '\n');
await writeFile('config.json', JSON.stringify(config, null, 2) + '\n');
```

### `migrate(content, options?)`

| Parameter | Type | Description |
|---|---|---|
| `content` | `string` | Raw `.bs` file contents |
| `options.id` | `string` | Override document ID (default: `shortname` from metadata, or `"spec"`) |

Returns `Promise<{ md: string; config: object }>`.

---

## What gets transformed

### Metadata block → `config.json`

The `<pre class='metadata'>` block is extracted and converted to a Speculator `config.json`:

| Bikeshed key | `config.json` path |
|---|---|
| `Title:` | `title` + `respec.title` |
| `Shortname:` | `respec.shortName` |
| `Status:` | `respec.specStatus` |
| `ED:` | `respec.thisVersion` |
| `TR:` | `respec.latestVersion` |
| `!Created:` | `respec.creationDate` |
| `!Modified:` | `respec.modificationDate` |
| `Editor:` | `respec.editors[]` |
| `Former Editor:` | `custom.formerEditors[]` |
| `Repository:` | `respec.repository` |
| `Group:` | `respec.group` |
| `Abstract:` | `respec.abstract` |
| `Max ToC Depth:` | `respec.maxTocLevel` |
| `Test Suite:` | `custom.testSuite` |
| `Boilerplate: issues-index no` | `noConformance: true` |

### Bibliography block → `config.json`

The `<pre class=biblio>` JSON block is stripped from the content and its entries are placed under `respec.localBiblio`. Bikeshed's `href` field is remapped to `url`.

### Content transforms → `index.md`

| Bikeshed construct | Output |
|---|---|
| `<xmp class="idl">` | `` ```webidl `` fenced code block |
| `<pre highlight="lang">` | `` ```lang `` fenced code block |
| `<pre class="idl">` | `` ```webidl `` fenced code block |
| `<figure class="example"><pre highlight="lang">` | `` ```lang `` fenced code block (figure wrapper stripped) |
| `<h1>`–`<h6 id="x">Text</h6>` | `## Text ## {#x}` Markdown heading |
| `<div algorithm="x">` | `<section data-algorithm="x">` |
| `[[!REF]]`, `[=term=]`, `{{Interface}}` | passed through unchanged |
| `Issue(N):` | passed through unchanged |
| `<dfn>`, `<dl>`, `<figure>`, `<div class="example">` | HTML passthrough |

---

## Example output

**Input** (`index.bs` excerpt):

```bikeshed
<pre class='metadata'>
Title: Solid-OIDC
Shortname: solid-oidc
Status: CG-DRAFT
ED: https://solid.github.io/solid-oidc/
TR: https://solidproject.org/TR/oidc
Editor: [Aaron Coburn](https://people.apache.org/~acoburn/#i) ([Inrupt](https://inrupt.com))
Abstract:
  The Solid OpenID Connect specification defines how resource servers
  verify the identity of relying parties and end users.
</pre>

# Introduction # {#intro}

The OAuth 2.0 [[!RFC6749]] framework...

<figure class="example">
  <pre highlight="turtle">
    PREFIX solid: &lt;http://www.w3.org/ns/solid/terms#&gt;
  </pre>
</figure>
```

**Output `index.md`**:

```markdown
# Introduction # {#intro}

The OAuth 2.0 [[!RFC6749]] framework...

```turtle
PREFIX solid: <http://www.w3.org/ns/solid/terms#>
```
```

**Output `config.json`**:

```json
{
  "id": "solid-oidc",
  "title": "Solid-OIDC",
  "respec": {
    "title": "Solid-OIDC",
    "shortName": "solid-oidc",
    "specStatus": "CG-DRAFT",
    "thisVersion": "https://solid.github.io/solid-oidc/",
    "latestVersion": "https://solidproject.org/TR/oidc",
    "editors": [
      { "name": "Aaron Coburn", "url": "...", "company": "Inrupt", "companyUrl": "..." }
    ],
    "abstract": "The Solid OpenID Connect specification...",
    "localBiblio": {}
  }
}
```

---

## Extending for new Bikeshed constructs

When you encounter a Bikeshed construct not yet handled:

1. **Block to strip from content** → add an extractor in [`src/extract/`](src/extract/)
2. **In-content transform** → add a transform in [`src/transform/`](src/transform/) and register it in [`remark-bikeshed.ts`](src/transform/remark-bikeshed.ts)
3. **New metadata key** → add a mapping in [`src/build-config.ts`](src/build-config.ts)
4. Add a test case

## Known limitations

- **Comma-separated editor format** (e.g. `Editor: Name, Company url, email, w3cid N`) is not parsed into structured fields — the full string is used as the `name`. Clean up manually after migration.
- `<figure>` and `<div class="example">` wrappers are stripped when hoisting code blocks; caption text is not preserved in the output.
