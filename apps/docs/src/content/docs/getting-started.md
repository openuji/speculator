---
title: Getting Started
description: How to install and use Speculator.
---

Welcome to Speculator! This guide will help you get up and running with the core packages.

## Installation

You can install the core packages using your favorite package manager.

```bash
pnpm add @openuji/speculator
```

## Basic Usage

To start using Speculator, you'll typically use the `speculate` function to process a document with a set of plugins.

```typescript
import { speculate, corePlugins } from "@openuji/speculator";

const result = await speculate({
  entry: "path/to/spec.md",
  plugins: corePlugins,
});

console.log(result.workspace);
```

## Workspaces

For managing multiple isolated specifications, Speculator provides a workspace building utility. This allows you to process multiple documents at once, keeping their namespaces and references isolated.

```typescript
import { buildWorkspaces } from "@openuji/speculator";

const workspacesConfig = {
  coreSpecs: [
    { entry: "spec/core/index.md" },
    { entry: "spec/api/index.html" },
  ],
  addonSpecs: [
    { entry: "addons/ui/index.md" },
    { entry: "addons/storage/index.md" },
  ],
};

const result = await buildWorkspaces(workspacesConfig);

if (result.errors.length > 0) {
  console.error("Errors encountered:", result.errors);
}

// Access built workspace coreSpecs AST
console.log(result.workspaces.coreSpecs);
```

## Next Steps

Check out the [Configuration](/configuration) guide to learn how to structure your specs, or the [API Reference](/api/speculator) for more detailed information.
