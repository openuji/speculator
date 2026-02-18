---
title: Spec Statements
description: Machine-readable normative requirements with JSON-LD output.
---

The `<spec-statement>` element marks normative requirements in your specification, enabling automatic extraction of requirements into machine-readable JSON-LD.

## Vocabulary

Speculator’s JSON-LD output for `<spec-statement>` is modeled using the **Spec Terms** vocabulary (prefix `spec:`, namespace `http://www.w3.org/ns/spec#`). This vocabulary is used to represent specification requirements, their requirement level (e.g., MUST/SHOULD/MAY), and their requirement subject (“classes of products”), and is used in ecosystems like Solid QA and related conformance tooling.

In particular, Speculator emits:

- `spec:Requirement` resources for requirements
- `spec:requirementLevel` (e.g., `spec:MUST`, `spec:SHOULD`, `spec:MAY`)
- `spec:requirementSubject` for the class of product the requirement applies to
- `spec:statement` for the requirement text

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

The requirement level is automatically detected from **BCP 14** keywords (RFC 2119 + RFC 8174) when they appear in ALL CAPS:

| Keyword      | Emitted JSON-LD                                                   |
| ------------ | ----------------------------------------------------------------- |
| `MUST`       | `type: spec:Requirement`, `spec:requirementLevel: spec:MUST`      |
| `MUST NOT`   | `type: spec:Requirement`, `spec:requirementLevel: spec:MUSTNOT`   |
| `SHOULD`     | `type: spec:Requirement`, `spec:requirementLevel: spec:SHOULD`    |
| `SHOULD NOT` | `type: spec:Requirement`, `spec:requirementLevel: spec:SHOULDNOT` |
| `MAY`        | `type: spec:Requirement`, `spec:requirementLevel: spec:MAY`       |
| (else)       | not rendered                                                      |

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

## Requirement Subjects (`data-cop-concept`)

The `data-cop-concept` attribute specifies the **class of products** that a requirement applies to:

```html
<spec-statement data-cop-concept="client"
  >The client MUST send credentials.</spec-statement
>
```

### Resolution Rules

| Input         | Output             | Notes                     |
| ------------- | ------------------ | ------------------------- |
| `client`      | `{specIri}#client` | Bare token → absolute IRI |
| `#IDP`        | `{specIri}#IDP`    | Fragment → absolute IRI   |
| `https://...` | `https://...`      | External IRI (unchanged)  |

This generates JSON-LD with `spec:requirementSubject`:

```json
{
  "id": "https://example.org/spec/1.0.0#auth-requirement",
  "type": "spec:Requirement",
  "spec:requirementLevel": { "id": "spec:MUST" },
  "spec:requirementSubject": { "id": "https://example.org/spec/1.0.0#client" }
}
```

### Inheritance from Sections

`data-cop-concept` can also be set on sections, and statements inherit from their parent:

```html
<section id="server" data-cop-concept="server">
  <h2>Server Requirements</h2>

  <!-- Inherits data-cop-concept="server" -->
  <spec-statement>The server MUST validate tokens.</spec-statement>

  <!-- Override for this statement -->
  <spec-statement data-cop-concept="client"
    >The client MAY cache tokens.</spec-statement
  >
</section>
```

See [Section Attributes](/features/section-attributes) for more on `data-cop-concept` inheritance.

## JSON-LD Output

Speculator generates JSON-LD for all statements in `document.computed.statementsJsonLd`:

```json
{
  "@context": {
    "dct": "http://purl.org/dc/terms/",
    "spec": "http://www.w3.org/ns/spec#",
    "skos": "http://www.w3.org/2004/02/skos/core#",
    "id": "@id",
    "type": "@type"
  },
  "@graph": [
    {
      "id": "https://example.org/spec/1.0.0",
      "type": "spec:Specification",
      "dct:title": "My Specification",
      "spec:classesOfProducts": {
        "id": "https://example.org/spec/1.0.0#classes-of-products",
        "type": "skos:ConceptScheme",
        "skos:prefLabel": "Classes of Products",
        "skos:hasTopConcept": [
          { "id": "https://example.org/spec/1.0.0#server" },
          { "id": "https://example.org/spec/1.0.0#client" }
        ]
      },
      "spec:requirement": [
        {
          "id": "https://example.org/spec/1.0.0#the-server-must-validate-tokens"
        },
        { "id": "https://example.org/spec/1.0.0#the-client-may-cache-tokens" }
      ]
    },
    {
      "id": "https://example.org/spec/1.0.0#server",
      "type": "skos:Concept",
      "skos:prefLabel": "Server",
      "skos:inScheme": {
        "id": "https://example.org/spec/1.0.0#classes-of-products"
      },
      "skos:topConceptOf": {
        "id": "https://example.org/spec/1.0.0#classes-of-products"
      }
    },
    {
      "id": "https://example.org/spec/1.0.0#client",
      "type": "skos:Concept",
      "skos:prefLabel": "Client",
      "skos:inScheme": {
        "id": "https://example.org/spec/1.0.0#classes-of-products"
      },
      "skos:topConceptOf": {
        "id": "https://example.org/spec/1.0.0#classes-of-products"
      }
    },
    {
      "id": "https://example.org/spec/1.0.0#the-server-must-validate-tokens",
      "type": "spec:Requirement",
      "spec:requirementSubject": {
        "id": "https://example.org/spec/1.0.0#server"
      },
      "spec:requirementLevel": { "id": "spec:MUST" },
      "spec:statement": "The server MUST validate tokens."
    },
    {
      "id": "https://example.org/spec/1.0.0#the-client-may-cache-tokens",
      "type": "spec:Requirement",
      "spec:requirementSubject": {
        "id": "https://example.org/spec/1.0.0#client"
      },
      "spec:requirementLevel": { "id": "spec:MAY" },
      "spec:statement": "The client MAY cache tokens."
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

## Block Content

Spec statements can contain block-level Markdown elements, such as lists and tables.

### Lists

```markdown
<spec-statement>
The server MUST validate the request by checking:

- The `Authorization` header presence
- The token expiration timestamp
- The issuer signature
  </spec-statement>
```

### Recursive Lists

```markdown
<spec-statement>
The configuration object MUST contain:

- `id` (string): Unique identifier
- `options` (object):
  - `retries` (number): Max retry count
  - `timeout` (number): Request timeout in ms
    </spec-statement>
```

### Tables

```markdown
<spec-statement>
The response body MUST comply with the following schema:

| Field    | Type   | Description      |
| -------- | ------ | ---------------- |
| `status` | string | Operation result |
| `code`   | number | Error code       |

</spec-statement>
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
- **JSON-LD output** uses plain text: `"The client MUST send a Content-Type header."`

## Related

- [Section Attributes](/features/section-attributes) – `data-cop-concept` inheritance and `.unnumbered`
- [Configuration](/configuration) – `baseUrl` and spec metadata
- [Solid QA](https://solidproject.org/ED/qa)
- [solid-contrib/specification-tests](https://github.com/solid-contrib/specification-tests) Test coverage report
- [URIs for W3C Namespaces](https://www.w3.org/guide/editor/namespaces)
