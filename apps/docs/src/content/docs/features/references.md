---
title: References & Citations
description: Documentation for Speculator's cross-reference and citation system, including xref and data-cite attributes.
---

Speculator provides a powerful system for cross-referencing definitions across your workspace and citing external specifications. This system is primarily driven by the `<xref>` element and specific attributes on `<a>` tags.

## Cross-References (`<xref>`)

The `<xref>` custom element is used to create links to terms defined within your workspace or in external specifications. Speculator uses **Semantic Resolution**: it matches terms based on their normalized names and logical context, rather than hardcoded IDs.

### Internal Workspace References

When you use `<xref>` without a `data-xref-spec` attribute, Speculator attempts to find a definition for the term within the current workspace.

```html
<xref data-lt="my term" data-link-for="MyInterface">link text</xref>
```

- **`data-lt`**: (Optional) The term to link to. If omitted, the text content of the element is used. Can be a pipe-separated list of aliases.
- **`data-link-for` / `data-xref-for`**: (Primary Disambiguation) Specifying the context (e.g., interface name) allows Speculator to resolve ambiguous terms to the correct definition.
- **`data-link-type`**: (Optional) The type of the target (e.g., `dfn`, `idl`, `element`).

> [!IMPORTANT]
> **ID-Based resolution is NOT supported.** Hardcoding `href="#id"` for cross-references is brittle and bypasses the semantic validation engine. Always use the term name and, if necessary, the context attribute to disambiguate.

### External References

To link to a term defined in an external specification, use the `data-xref-spec` attribute.

```html
<xref data-xref-spec="html" data-lt="the a element">the &lt;a&gt; element</xref>
```

- **`data-xref-spec`**: The shortname of the external spec as defined in your bibliography or configuration.

## Citations (`[[key]]`)

Speculator supports ReSpec-style citation syntax. Citations are typically written in double brackets.

- `[[RFC2119]]`: Informative citation.
- `[[!RFC2119]]`: Normative citation.
- `[[?RFC2119]]`: Specifically marked informative citation.

### HTML Citation Attribute (`data-cite`)

You can also use the `data-cite` attribute on `<a>` tags to create citations.

```html
<a data-cite="WHATWG-URL">URL Specification</a>
```

- **`data-cite`**: The citation key. If it starts with `!`, it is treated as normative.

### Advanced `data-cite`

The `data-cite` attribute supports fragments and paths for external specs:

```html
<a data-cite="html#the-a-element">the a element</a>
```

## Automatic Sections

Speculator automatically generates certain standard sections to help you write compliant specifications faster.

### Conformance Section

If your document does not already contain a section with `id="conformance"`, Speculator will automatically inject a standard **Conformance** section at the beginning of your document.

This injected section:

- Is **unnumbered** to avoid interfering with your document's outline.
- Defines the key words MUST, SHOULD, MAY, etc., linking them to [[!RFC2119]] and [[!RFC8174]].

### Bibliography Generation

Speculator automatically collects all citations used in your document and generates a **References** section at the end.

- **Normative References**: Contains all citations marked with `!` or forced normative by the Conformance section.
- **Informative References**: Contains all other citations.

If a citation is used as both normative and informative, it will be promoted to Normative.

## Configuration

You can define local bibliography entries in your `config.json` (or frontmatter) to provide details for your citations.

```json
{
  "localBiblio": {
    "RFC2119": {
      "title": "Key words for use in RFCs to Indicate Requirement Levels",
      "url": "https://datatracker.ietf.org/doc/html/rfc2119",
      "authors": ["S. Bradner"],
      "date": "March 1997",
      "publisher": "IETF",
      "status": "Best Current Practice"
    }
  }
}
```

If an entry is not found in `localBiblio`, Speculator will attempt to fallback to a global bibliography (if configured) or display a raw placeholder.
