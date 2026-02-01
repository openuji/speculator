---
title: Spec Statements
description: Machine-readable normative requirements with JSON-LD output.
---

The `<spec-statement>` element marks normative requirements in your specification, enabling automatic extraction of requirements into machine-readable JSON-LD format.

## Basic Syntax

### HTML

```html
<spec-statement
  >The client MUST authenticate before making requests.</spec-statement
>
```

### Markdown

Embed the HTML element directly in your Markdown:

```markdown
<spec-statement>The server MUST return a 200 status code on success.</spec-statement>
```

## Normative Levels

The requirement level is automatically detected from RFC 2119 keywords:

| Keyword      | JSON-LD Type          |
| ------------ | --------------------- |
| `MUST`       | `spec:Requirement`    |
| `MUST NOT`   | `spec:Prohibition`    |
| `SHOULD`     | `spec:Recommendation` |
| `SHOULD NOT` | `spec:Recommendation` |
| `MAY`        | `spec:Permission`     |
| (none)       | `spec:Statement`      |

You can also set the level explicitly:

```html
<spec-statement level="MUST"
  >Clients authenticate before requests.</spec-statement
>
```

## Explicit IDs

By default, IDs are generated from the statement text. You can set an explicit ID:

```html
<spec-statement id="auth-requirement"
  >The client MUST authenticate.</spec-statement
>
```

## Requirement Subjects (data-cop)

The `data-cop` attribute specifies the **class of products** that a requirement applies to:

```html
<spec-statement data-cop="client"
  >The client MUST send credentials.</spec-statement
>
```

This generates JSON-LD with `spec:requirementSubject`:

```json
{
  "id": "https://example.org/spec#auth-requirement",
  "type": "spec:Requirement",
  "spec:requirementLevel": { "id": "spec:MUST" },
  "spec:requirementSubject": { "id": "spec:Client" }
}
```

### Inheritance from Sections

`data-cop` can also be set on sections, and statements inherit from their parent:

```html
<section data-cop="server">
  <h2>Server Requirements</h2>

  <!-- Inherits data-cop="server" -->
  <spec-statement>The server MUST validate tokens.</spec-statement>

  <!-- Override for this statement -->
  <spec-statement data-cop="client"
    >The client MAY cache tokens.</spec-statement
  >
</section>
```

See [Section Attributes](/features/section-attributes) for more on `data-cop` inheritance.

## JSON-LD Output

Speculator generates JSON-LD for all statements in `document.computed.statementsJsonLd`:

```json
{
  "@context": {
    "dct": "http://purl.org/dc/terms/",
    "spec": "http://www.w3.org/ns/spec#",
    "id": "@id",
    "type": "@type"
  },
  "id": "https://example.org/spec/1.0.0",
  "type": "spec:Specification",
  "dct:title": "My Specification",
  "spec:classesOfProducts": [{ "id": "spec:Client" }, { "id": "spec:Server" }],
  "spec:requirement": [
    {
      "id": "https://example.org/spec/1.0.0#the-server-must-validate-tokens",
      "type": "spec:Requirement",
      "spec:requirementLevel": { "id": "spec:MUST" },
      "spec:statement": "The server MUST validate tokens.",
      "spec:requirementSubject": { "id": "spec:Server" }
    },
    {
      "id": "https://example.org/spec/1.0.0#the-client-may-cache-tokens",
      "type": "spec:Permission",
      "spec:requirementLevel": { "id": "spec:MAY" },
      "spec:statement": "The client MAY cache tokens.",
      "spec:requirementSubject": { "id": "spec:Client" }
    }
  ]
}
```

### Embedding in HTML

To include the JSON-LD in your rendered page:

```html
<script type="application/ld+json">
  {statementsJsonLd}
</script>
```

## Configuration

### specIri / baseUrl

The `specIri` is the base IRI for statement identifiers. It's assembled from:

1. **Explicit `baseUrl`** in config.json + document `id`
2. **`respec.thisVersion`** as fallback
3. **Document `id`** as final fallback

```json
{
  "id": "my-spec",
  "baseUrl": "https://example.org/specs"
}
```

Results in statement IRIs like: `https://example.org/specs/my-spec#stmt-1`

## Rich Content

Statements can contain rich Markdown formatting:

```markdown
<spec-statement>The client **MUST** send a `Content-Type` header.</spec-statement>
```

- **HTML output** preserves the rich formatting (`<strong>`, `<code>`)
- **JSON-LD output** uses plain text: `"the client must send a content-type header."`

## Related

- [Section Attributes](/features/section-attributes) – `data-cop` inheritance and `.unnumbered`
- [Configuration](/configuration) – `baseUrl` and spec metadata
