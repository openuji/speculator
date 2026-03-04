---
title: Section Attributes
description: Configure section behavior with classes and data attributes.
---

Sections and headings in your specification can be enhanced with special classes and data attributes to control TOC numbering and requirement subject inheritance.

## Schema Reference

The relevant properties are defined on `Section` and `BlockHeading` nodes:

```typescript
interface Section {
  type: "section";
  id?: string;
  heading?: BlockHeading;
  unnumbered?: boolean;
  dataCopConcept?: string;
  children: (Section | Block)[];
}
```

## Requirement Subjects (`data-cop-concept`)

The `data-cop-concept` attribute specifies the **class of products** that requirements in a section apply to. This enables machine-readable categorization of requirements.

### HTML Syntax

```html
<section data-cop-concept="client">
  <h2>Client Requirements</h2>

  <!-- All spec-statements inherit data-cop-concept="client" -->
  <spec-statement>The client MUST authenticate.</spec-statement>
  <spec-statement>The client SHOULD cache tokens.</spec-statement>
</section>
```

### Markdown Syntax

Use the `{data-cop=value}` suffix:

```markdown
## Client Requirements {data-cop-concept=client #client}

<spec-statement>The client MUST authenticate.</spec-statement>
```

### Inheritance

`data-cop-concept` cascades down to all nested sections and statements:

```html
<section id="server" data-cop-concept="server">
  <h2>Server Requirements</h2>

  <!-- Inherits server -->
  <spec-statement>The server MUST validate tokens.</spec-statement>

  <section data-cop-concept="client">
    <h3>Client-Server Interaction</h3>

    <!-- Overridden to client -->
    <spec-statement>The client MUST retry on 503.</spec-statement>
  </section>
</section>
```

**NOTE:** to make this referenceable, the **section** must get the same `id` attribute as the `data-cop-concept` value.

### Statement-Level Override

Individual statements can override the inherited value:

```html
<section data-cop-concept="server">
  <h2>Server Section</h2>

  <!-- Uses inherited "server" -->
  <spec-statement>The server MUST respond with JSON.</spec-statement>

  <!-- Overridden to "client" -->
  <spec-statement data-cop-concept="client"
    >The client MUST parse JSON.</spec-statement
  >
</section>
```

### JSON-LD Output

When `data-cop-concept` is set, statements include `spec:requirementSubject` in the JSON-LD:

```json
{
  "@context": { ... },
  "@graph": [
    {
      "id": "https://example.org/spec",
      "type": "spec:Specification",
    {
      "id": "https://example.org/spec",
      "type": "spec:Specification",
      "spec:classesOfProducts": {
        "id": "https://example.org/spec#classes-of-products",
        "type": "skos:ConceptScheme",
        "skos:hasTopConcept": [
          { "id": "https://example.org/spec#client" }
        ]
      },
      "spec:requirement": [
        { "id": "https://example.org/spec#stmt-1" }
      ]
    },
    {
      "id": "https://example.org/spec#client",
      "type": "skos:Concept",
      "skos:inScheme": { "id": "https://example.org/spec#classes-of-products" },
      "skos:topConceptOf": { "id": "https://example.org/spec#classes-of-products" }
    },
    {
      "id": "https://example.org/spec#stmt-1",
      "type": "spec:Requirement",
      "spec:statement": "the client must authenticate.",
      "spec:requirementSubject": { "id": "https://example.org/spec#client" }
    }
  ]
}
```

See [Spec Statements](/features/spec-statements) for more on JSON-LD output.

---

## TOC Exclusion and Unnumbered Sections

Some sections—like **Abstract** and **Status of This Document (SOTD)**—should appear in the Table of Contents without a section number, or even be excluded entirely from the TOC.

### How It Works

When a section is marked to omit TOC numbering (`data-no-toc-counter`) or excluded entirely (`data-no-toc`):

1. **`data-no-toc-counter`**: It appears in the TOC **without a number**. Subsequent numbered sections continue from where numbering left off. The section is **not included** in `document.computed.headingNumbers`.
2. **`data-no-toc`**: The section and its children are completely excluded from the generated Table of Contents.

### HTML Syntax

Add the data attributes to your `<section>` element:

```html
<!-- Exclude from TOC entirely -->
<section id="abstract" data-no-toc>
  <h1>Abstract</h1>
  <p>This section is excluded from the TOC entirely.</p>
</section>

<!-- Include in TOC, but without a number -->
<section id="sotd" data-no-toc-counter>
  <h1>Status of This Document</h1>
</section>
```

### Markdown Syntax

Use the `{data-no-toc}` or `{data-no-toc-counter}` suffix on headings:

```markdown
# Abstract {data-no-toc}

This is an abstract excluded from TOC.

# Introduction

This should be numbered as "1".
```

### Cascading to Children

When a parent section is marked with `data-no-toc` or `data-no-toc-counter`, **all child sections automatically inherit the status**.

---

## Related

- [Spec Statements](/features/spec-statements) – Machine-readable requirements with JSON-LD
- [TOC Plugin](/api/speculator/toc) – Generates table of contents
