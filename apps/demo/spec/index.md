# Introduction

This is a demonstration of the **Speculator** parsing system.

It covers various markdown features.

## Text Formatting

We support *emphasis*, **strong text**, `inline code`, and [links](https://example.com).

## Lists

### Unordered

- Item 1
- Item 2
  - Nested Item 2.1
  - Nested Item 2.2

### Ordered

1. First
2. Second
3. Third

## Code Blocks

```typescript
function hello() {
    console.log("Hello World");
}
```

## Blockquotes

> This is a blockquote.
> It can span multiple lines.

## Includes

:::include ./included.md :::

## Definitions

This spec defines {{Term}} as a concept. One can refer to [[Term]].

## Requirements

The implementation MUST support this requirement.

## Issues

This is an open issue: {{?issue-id Open Issue regarding semantics}}.

