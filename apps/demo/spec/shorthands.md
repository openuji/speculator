# ReSpec Shorthands Demo {.unnumbered}

This document provides a comprehensive look at the shorthands supported by Speculator and demonstrates how they resolve in the AST.

## Internal Concepts and Cross-references

<dfn>Algorithm</dfn> is a term defined here using the concept shorthand.

Now we can refer to [=Algorithm=] elsewhere, and it will link back to the definition below.
You can also use an alias: [=Algorithm|the great process=].

## Algorithm Variables

ReSpec variables like |x| or |pending result| are parsed as specialized `<var>` elements in the AST.

Examples:

- We take |x| and add |y|.
- If |pending result| is empty, return null.

## Linked Citations

Citations should resolve to bibliography entries if available.

- Normative: [[!RFC2119]]
- Informative: [[?WHATWG-URL]]
- Expanded: [[[DOM]]]

## Mixed Usage

Shorthands can be mixed freely:

- If |p| is true in [[HTML]], then [=Algorithm=] should be invoked.

## Comparison with HTML

Below are examples of how these Markdown shorthands compare to their HTML equivalents:

| Markdown   | HTML Equivalent                    | AST Type    |
| ---------- | ---------------------------------- | ----------- |
| `[[REF]]`  | `<cite data-cite="REF">`           | `cite`      |
| `[=term=]` | `<a data-link-type="dfn">term</a>` | `reference` |
| `\|var\|`  | `<var>var</var>`                   | `variable`  |
| `{{IDL}}`  | `<a data-link-type="idl">IDL</a>`  | `reference` |

## Extension Status

| Shorthand  | Status | Description |
| ---------- | ------ | ----------- |
| `[[REF]]`  | [x]    | Citation    |
| `[=term=]` | [x]    | Concept     |
| `\|var\|`  | [x]    | Variable    |
| `{{idl}}`  | [x]    | WebIDL      |
| `[^tag^]`  | [x]    | Element     |

---

## Internal Definition for Test

<dfn id="dfn-algorithm">Algorithm</dfn>
