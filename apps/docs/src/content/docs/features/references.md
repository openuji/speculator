---
title: References & Citations
description: Documentation for Speculator's cross-reference and citation system, including xref and data-cite attributes.
---

Speculator provides a powerful system for cross-referencing definitions across your workspace and citing external specifications. This system is primarily driven by the `<xref>` element and specific attributes on `<a>` tags.

## Cross-References (`<xref>`)

The `<xref>` custom element is used to create links to terms defined within your workspace or in external specifications.

### Internal Workspace References

When you use `<xref>` without a `data-xref-spec` attribute, Speculator attempts to find a definition for the term within the current workspace.

```html
<xref data-lt="my term">link text</xref>
```

- **`data-lt`**: (Optional) The term to link to. If omitted, the text content of the element is used. Can be a pipe-separated list of aliases.
- **`data-xref-for`**: (Optional) The context (e.g., interface name) the term belongs to.
- **`data-link-type`**: (Optional) The type of the target (e.g., `dfn`, `idl`, `element`).

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

The `data-cite` attribute supports fragments and paths:

```html
<a data-cite="html#the-a-element">the a element</a>
```

## Behavior of `<a>` Elements

Speculator also intercepts standard `<a>` tags if they contain ReSpec-compatible attributes like `data-lt` or `data-cite`. If these attributes are present, the `<a>` tag is treated as a reference or citation rather than a regular external link.

| Attribute        | Behavior                                                        |
| :--------------- | :-------------------------------------------------------------- |
| `href`           | Regular link (unless `data-cite` or `data-lt` is present).      |
| `data-cite`      | Becomes an `InlineCite` node.                                   |
| `data-lt`        | Becomes a workspace or external reference node.                 |
| `data-link-type` | Guides the resolution to IDL, elements, or general definitions. |
