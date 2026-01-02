---
title: Unnumbered Sections
description: How to exclude sections like Abstract and SOTD from TOC numbering.
---

Some sections in specifications—like **Abstract** and **Status of This Document (SOTD)**—should appear in the Table of Contents without a section number. Speculator supports marking sections as "unnumbered" so they don't increment the TOC counter.

## How It Works

When a section is marked as `unnumbered`:

1. It appears in the TOC **without a number**
2. Subsequent numbered sections continue from where numbering left off
3. The section is **not included** in `document.computed.headingNumbers`

### Example Output

Given this structure:

```
Abstract (unnumbered)
Status of This Document (unnumbered)
Introduction
Methods
```

The TOC will display:

```
     Abstract
     Status of This Document
1.   Introduction
2.   Methods
```

## HTML Syntax

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
  <p>This section is also unnumbered.</p>
</section>

<!-- Using 'introductory' class (implies unnumbered) -->
<section id="intro-note" class="introductory">
  <h1>About This Spec</h1>
  <p>Also unnumbered.</p>
</section>
```

### Supported Class Names

| Class          | Effect                                  |
| -------------- | --------------------------------------- |
| `unnumbered`   | Explicitly marks section as unnumbered  |
| `informative`  | Non-normative section (also unnumbered) |
| `introductory` | Introductory content (also unnumbered)  |

## Markdown Syntax

Use the `{.unnumbered}` suffix on headings:

```markdown
# Abstract {.unnumbered}

This is an unnumbered abstract.

# Status {.unnumbered}

This is also unnumbered.

# Introduction

This should be numbered as "1".

# Methods

This should be "2".
```

The `{.unnumbered}` suffix is automatically stripped from the heading text in the output.

## Nested Unnumbered Sections

You can mark nested sections as unnumbered without affecting sibling numbering:

```html
<section id="main">
  <h1>Main Content</h1>

  <section id="note" class="unnumbered">
    <h2>Informative Note</h2>
    <p>This subsection is unnumbered.</p>
  </section>

  <section id="details">
    <h2>Implementation Details</h2>
    <p>This is numbered as 2.1 (not 2.2).</p>
  </section>
</section>
```

The TOC for this structure:

```
1.     Main Content
       Informative Note
1.1    Implementation Details
```

## Schema Reference

The `unnumbered` property is defined on both `Section` and `BlockHeading` nodes:

```typescript
interface Section {
  type: "section";
  id?: string;
  heading?: BlockHeading;
  unnumbered?: boolean; // ← This property
  children: (Section | Block)[];
}
```

## Related

- [TOC Plugin](/api/speculator/toc) – Generates table of contents
- [Section Parsing](/api/speculator/sections) – How sections are parsed from HTML/Markdown
