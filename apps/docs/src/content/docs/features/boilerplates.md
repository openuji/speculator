---
title: Boilerplates
description: Document explicit formatting tags like `<spec-biblio-references />`.
---

Speculator no longer relies on automatic injection of complex sections like Conformance or Bibliographies by default, moving towards a more explicit and predictable authoring model.

## Explicit Formatting Tags

You can use specific explicit HTML custom elements in your specification to signal where generated content should be placed.

### Bibliography Generation (`<spec-biblio-references />`)

To insert the generated normative and informative references, place the `<spec-biblio-references />` tag exactly where you want the bibliography to appear in your document structure.

```markdown
## Normative References

<spec-biblio-references />
```

During the build-time pipeline, Speculator will:

1. Detect this explicit tag.
2. Resolve all citations throughout the document.
3. Replace the tag with the fully formatted HTML definition list (`<dl>`) of references.

**Note:** If you do not include this tag, the bibliography will not be generated automatically.
