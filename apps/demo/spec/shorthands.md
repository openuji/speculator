# ReSpec Shorthands Demo {.unnumbered}

This document demonstrates all shorthands supported by Speculator.

## Internal Concepts and Cross-references

<dfn>Algorithm</dfn> is a term defined here using HTML.

Now we can refer to [=Algorithm=] elsewhere, and it will link back to the definition.
You can also use an alias: [=Algorithm|the great process=].

## Algorithm Variables

ReSpec variables like |x| or |pending result| are parsed as specialized `<var>` elements.

Examples:

- We take |x| and add |y|.
- If |pending result| is empty, return null.

## Citations

Citations reference bibliography entries.

- Standard citation: [[DOM]]
- Normative (required): [[!RFC2119]]
- Informative (optional): [[?WHATWG-URL]]
- Expanded (shows full title): [[[HTML]]]

## WebIDL References

Use double braces for WebIDL interface and member references:

- The {{Document}} interface provides methods for querying the DOM.
- Call {{Element/getAttribute}} to retrieve an attribute value.
- The {{NodeList}} is returned by many DOM methods.

## Element References

Use `[^element^]` syntax to reference HTML/SVG elements:

- The [^div^] element is a generic container.
- Use [^input^] for form controls.
- The [^script^] element loads JavaScript.

## Mixed Usage

Shorthands can be mixed freely:

- If |p| is true in [[HTML]], then [=Algorithm=] should be invoked.
- The {{Document/querySelector}} method returns an [^element^] or null.

## Summary Table

| Shorthand     | Syntax            | Example               | AST Type    |
| ------------- | ----------------- | --------------------- | ----------- |
| Citation      | `[[REF]]`         | `[[DOM]]`             | `cite`      |
| Normative     | `[[!REF]]`        | `[[!RFC2119]]`        | `cite`      |
| Informative   | `[[?REF]]`        | `[[?WHATWG-URL]]`     | `cite`      |
| Expanded      | `[[[REF]]]`       | `[[[HTML]]]`          | `cite`      |
| Concept       | `[=term=]`        | `[=Algorithm=]`       | `reference` |
| Concept Alias | `[=term\|alias=]` | `[=Algorithm\|algo=]` | `reference` |
| Variable      | `\|var\|`         | `\|x\|`               | `variable`  |
| WebIDL        | `{{IDL}}`         | `{{Document}}`        | `reference` |
| Element       | `[^tag^]`         | `[^div^]`             | `reference` |

---
