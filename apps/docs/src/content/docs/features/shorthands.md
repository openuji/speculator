---
title: Shorthands
---

# Shorthands

Speculator provides a set of powerful shorthands in Markdown that simplify authoring technical specifications. These shorthands are functionally equivalent to specific ReSpec-style HTML patterns.

## Summary Table

| Feature                       | Markdown Shorthand | HTML Equivalent                                    | AST Type                 |
| ----------------------------- | ------------------ | -------------------------------------------------- | ------------------------ |
| **Citation**                  | `[[REF]]`          | `<a data-cite="REF">REF</a>`                       | `InlineCite`             |
| **Normative Citation**        | `[[!REF]]`         | `<a data-cite="!REF">REF</a>`                      | `InlineCite`             |
| **Informative Citation**      | `[[?REF]]`         | `<a data-cite="?REF">REF</a>`                      | `InlineCite`             |
| **Expanded Citation**         | `[[[REF]]]`        | n/a                                                | `InlineCite`             |
| **Concept Reference**         | `[=term=]`         | `<a data-link-type="dfn">term</a>`                 | `InlineReference`        |
| **Concept with Alias**        | `[=term\|alias=]`  | `<a data-link-type="dfn" data-lt="term">alias</a>` | `InlineReference`        |
| **Variable**                  | `\|variable\|`     | `<var>variable</var>`                              | `InlineCode`             |
| **WebIDL Reference**          | `{{Interface}}`    | `<a data-link-type="idl">Interface</a>`            | `InlineReference`        |
| **Element Reference**         | `[^element^]`      | `<a data-link-type="element">element</a>`          | `InlineReference`        |
| **Section Reference**         | `[§#id]`           | `<a href="#id">§1.2</a>`                           | `InlineSectionReference` |
| **Section Reference Aliased** | `[§#id\|Label]`    | `<a href="#id">§1.2 Label</a>`                     | `InlineSectionReference` |
| **Issue Marker**              | `Issue(78):`       | `<aside class="issue">Open issue: <a href="https://github.com/org/repo/issues/78">#78</a></aside>` | `BlockNote`              |
| **Heading ID**                | `{#id}`            | `id="id"` on heading                               | `BlockHeading.id`        |

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

### WebIDL and Elements

Speculator supports identifying specific types of references for specialized styling or indexing.

- **WebIDL**: `{{PaymentRequest}}` → `<a data-link-type="idl">PaymentRequest</a>`
- **Elements**: `[^iframe^]` → `<a data-link-type="element">iframe</a>`

### Section Links

You can link to sections within the same document using the section symbol `§` followed by the section ID.

- **Basic Link**: `See [§#intro] for details.`
- **Aliased Link**: `Go to [§#intro|the introduction].`

The basic link will automatically display the section number (e.g., `§1.2`) if the target section is numbered.

If a custom label is provided (the aliased link), the section number is prepended to the label (e.g., `§1.2 the introduction`).

### Explicit Heading IDs

By default, section IDs are generated from the heading text. You can provide an explicit ID using the `{#id}` shorthand at the end of a heading.

- **Markdown**: `# My Section {#my-id}`
- **HTML Equivalent**: `<h1 id="my-id">My Section</h1>`

This is especially useful for maintaining stable links even if the heading text changes.

### Issue Shorthand

You can write Bikeshed-style issue markers directly in Markdown:

- `Issue(78):`
- `Issue(#78):`

When the identifier is a local issue number, Speculator resolves it using your config repository:

- Root-level `repository`, or
- `respec.repository`

Example: if repository is `https://github.com/solid/solid-oidc`, then `Issue(78):` resolves to `https://github.com/solid/solid-oidc/issues/78`.
