---
title: LikeC4 Diagrams
description: How to use LikeC4 diagrams in your specifications.
---

Speculator provides first-class support for [LikeC4](https://likec4.dev/) diagrams. LikeC4 allows you to define your architecture as code and render it as interactive diagrams.

## AST Implementation

The Speculator parser recognizes the `<likec4-view>` tag and transforms it into a dedicated `BlockLikeC4View` AST node with `type: 'likeC4View'`.

This semantic node allows components in the render pipeline (like Astro components) to easily identify and render the diagram using a `client:only` directive, ensuring that the heavy React-based diagram component is only loaded and executed in the browser.

## Usage

To include a LikeC4 view in your specification, use the `<likec4-view>` tag.

```html
<likec4-view view-id="oidc" />
```

### Attributes

| Attribute         | Description                                                               | Required |
| ----------------- | ------------------------------------------------------------------------- | -------- |
| `view-id`         | The unique identifier of the LikeC4 view to render.                       | Yes      |
| `dynamic-variant` | Specify a visualization variant. Supported values: `diagram`, `sequence`. | No       |

## Configuration

To enable LikeC4 support, you need to configure the `LikeC4VitePlugin` in your Astro project.

```javascript
// astro.config.mjs
import { LikeC4VitePlugin } from "likec4/vite-plugin";

export default defineConfig({
  // ...
  vite: {
    plugins: [
      LikeC4VitePlugin({
        workspace: path.resolve("spec"),
      }),
    ],
  },
});
```

## Example

```html
<likec4-view view-id="cloud-architecture" dynamic-variant="diagram" />
```

The rendered diagram will be interactive and responsive, integrated directly into your specification.
