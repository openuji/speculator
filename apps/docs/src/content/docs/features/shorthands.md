---
title: Shorthands
---

# Shorthands

Speculator provides a set of powerful shorthands in Markdown that simplify authoring technical specifications. These shorthands are functionally equivalent to specific ReSpec-style HTML patterns.

## Summary Table

| Feature                  | Markdown Shorthand | HTML Equivalent                                    | AST Type          |
| ------------------------ | ------------------ | -------------------------------------------------- | ----------------- |
| **Citation**             | `[[REF]]`          | `<a data-cite="REF">REF</a>`                       | `InlineCite`      |
| **Normative Citation**   | `[[!REF]]`         | `<a data-cite="!REF">REF</a>`                      | `InlineCite`      |
| **Informative Citation** | `[[?REF]]`         | `<a data-cite="?REF">REF</a>`                      | `InlineCite`      |
| **Expanded Citation**    | `[[[REF]]]`        | n/a                                                | `InlineCite`      |
| **Concept Reference**    | `[=term=]`         | `<a data-link-type="dfn">term</a>`                 | `InlineReference` |
| **Concept with Alias**   | `[=term\|alias=]`  | `<a data-link-type="dfn" data-lt="term">alias</a>` | `InlineReference` |
| **Variable**             | `\|variable\|`     | `<var>variable</var>`                              | `InlineCode`      |
| **WebIDL Reference**     | `{{Interface}}`    | `<a data-link-type="idl">Interface</a>`            | `InlineReference` |
| **Element Reference**    | `[^element^]`      | `<a data-link-type="element">element</a>`          | `InlineReference` |

## Detailed Usage

### Citations

Citations are used to reference other specifications. They are automatically resolved against biblio data.

- **Markdown**: `According to [[HTML]], ...`
- **HTML Equivalent**: `According to <a data-cite="HTML">HTML</a>, ...`

You can force a citation to be normative or informative:

- `[[!RFC2119]]` (Normative)
- `[[?FOO]]` (Informative)

### Internal Concepts

Use concepts to link to definitions within your workspace or external specifications.

- **Markdown**: `The [=queue a task=] algorithm...`
- **Markdown with Alias**: `The [=queue a task\|task queuing=] mechanism...`
- **HTML Equivalent**: `The <a data-link-type="dfn">queue a task</a> algorithm...`

### Algorithm Variables

Variables are commonly used in algorithm steps.

- **Markdown**: `Let \|result\| be ...`
- **HTML Equivalent**: `Let <var>result</var> be ...`

### WebIDL and Elements (Planned)

Speculator is expanding support for identifying specific types of references.

- **WebIDL**: `{{PaymentRequest}}` mappings to `<a data-link-type="idl">PaymentRequest</a>`.
- **Elements**: `[^iframe^]` mappings to `<a data-link-type="element">iframe</a>`.
