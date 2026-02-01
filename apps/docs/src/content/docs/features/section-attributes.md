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
  dataCop?: string;
  children: (Section | Block)[];
}
```

## Requirement Subjects (data-cop)

The `data-cop` attribute specifies the **class of products** that requirements in a section apply to. This enables machine-readable categorization of requirements.

### HTML Syntax

```html
<section data-cop="client">
  <h2>Client Requirements</h2>

  <!-- All spec-statements inherit data-cop="client" -->
  <spec-statement>The client MUST authenticate.</spec-statement>
  <spec-statement>The client SHOULD cache tokens.</spec-statement>
</section>
```

### Markdown Syntax

Use the `{data-cop=value}` suffix:

```markdown
## Client Requirements {data-cop=client}

<spec-statement>The client MUST authenticate.</spec-statement>
```

### Inheritance

`data-cop` cascades down to all nested sections and statements:

```html
<section data-cop="server">
  <h2>Server Requirements</h2>

  <!-- Inherits server -->
  <spec-statement>The server MUST validate tokens.</spec-statement>

  <section data-cop="client">
    <h3>Client-Server Interaction</h3>

    <!-- Overridden to client -->
    <spec-statement>The client MUST retry on 503.</spec-statement>
  </section>
</section>
```

### Statement-Level Override

Individual statements can override the inherited value:

```html
<section data-cop="server">
  <h2>Server Section</h2>

  <!-- Uses inherited "server" -->
  <spec-statement>The server MUST respond with JSON.</spec-statement>

  <!-- Overridden to "client" -->
  <spec-statement data-cop="client">The client MUST parse JSON.</spec-statement>
</section>
```

### JSON-LD Output

When `data-cop` is set, statements include `spec:requirementSubject` in the JSON-LD:

```json
{
  "id": "https://example.org/spec#stmt-1",
  "type": "spec:Requirement",
  "spec:statement": "the client must authenticate.",
  "spec:requirementSubject": { "id": "spec:Client" }
}
```

See [Spec Statements](/features/spec-statements) for more on JSON-LD output.

---

## Unnumbered Sections

Some sections—like **Abstract** and **Status of This Document (SOTD)**—should appear in the Table of Contents without a section number.

### How It Works

When a section is marked as `unnumbered`:

1. It appears in the TOC **without a number**
2. Subsequent numbered sections continue from where numbering left off
3. The section is **not included** in `document.computed.headingNumbers`

### HTML Syntax

Add one of the following CSS classes to your `<section>` element:

```html
<!-- Using 'unnumbered' class -->
<section id="abstract" class="unnumbered">
  <h1>Abstract</h1>
  <p>This section is unnumbered in the TOC.</p>
</section>

<!-- Using 'informative' class (implies unnumbered) -->
<section id="sotd" class="informative">
  <h1>Status of This Document</h1>
</section>

<!-- Using 'introductory' class (implies unnumbered) -->
<section id="intro-note" class="introductory">
  <h1>About This Spec</h1>
</section>
```

### Markdown Syntax

Use the `{.unnumbered}` suffix on headings:

```markdown
# Abstract {.unnumbered}

This is an unnumbered abstract.

# Introduction

This should be numbered as "1".
```

The `{.unnumbered}` suffix is automatically stripped from the heading text in the output.

### Supported Class Names

| Class          | Effect                                  |
| -------------- | --------------------------------------- |
| `unnumbered`   | Explicitly marks section as unnumbered  |
| `informative`  | Non-normative section (also unnumbered) |
| `introductory` | Introductory content (also unnumbered)  |

### Cascading to Children

When a parent section is marked as unnumbered, **all child sections automatically inherit the unnumbered status**.

---

## Related

- [Spec Statements](/features/spec-statements) – Machine-readable requirements with JSON-LD
- [TOC Plugin](/api/speculator/toc) – Generates table of contents
