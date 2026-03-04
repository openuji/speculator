---
title: Structural Elements
description: Authoring Guidelines for Examples, Issues, and Notes.
---

Speculator provides specialized support for various structural elements common in specifications. These elements are automatically parsed, assigned stable IDs, and specially rendered by the **Solospec** renderer.

## Notes

You can create aside notes to provide non-normative context or warnings to the reader.

### HTML Syntax

```html
<p class="note">This is a standard note.</p>
```

### Markdown Shorthand

Speculator provides a streamlined shorthand for standard notes using the `note:` prefix:

```markdown
note: This is an important implementation detail.
```

When using Solospec, these notes are rendered with a distinct visual style and labeled appropriately.

## Examples

Examples help clarify normative requirements. Speculator automatically assigns content-hash-based IDs to examples and provides them with self-linking anchors (`§`).

### HTML Syntax

Wrap your code blocks or explanatory text in a `<figure class="example">`:

```html
<figure class="example">
  <figcaption>Example JWT Payload</figcaption>
  <pre highlight="json">
  {
    "sub": "1234567890",
    "name": "John Doe",
    "iat": 1516239022
  }
  </pre>
</figure>
```

### Markdown Syntax

````markdown
<figure class="example">
  <figcaption>Example JWT Payload</figcaption>
  ```json
  {
    "sub": "1234567890",
    "name": "John Doe",
    "iat": 1516239022
  }
</figure>

````


In Solospec, examples are vividly rendered, often with an "EXAMPLE" badge and a copy button for the enclosed code.

## Issues

You can track open questions or unresolved topics directly in your specification. Like examples, issues automatically receive stable hash-based IDs and can be self-linked.

### Markdown Shorthand

You can use the `Issue(number):` syntax to reference external issue trackers or simply mark a block as an issue.

```markdown
Issue(42):
```

When rendered via Solospec, issues are prominently displayed (typically with a red/warning style) to ensure they are not overlooked during the drafting process.
