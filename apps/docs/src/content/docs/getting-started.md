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

To start using Speculator, you'll typically initialize a pipeline and process some documents.

```typescript
import { SpeculatorPipeline } from "@openuji/speculator";

const pipeline = new SpeculatorPipeline();
const result = await pipeline.process("path/to/spec.md");

console.log(result.ast);
```

## Workspaces

For managing multiple isolated specifications, Speculator provides a workspace building utility. This allows you to process multiple documents at once, keeping their namespaces and references isolated.

```typescript
import { buildWorkspaces } from "@openuji/speculator";

const workspacesConfig = {
  coreSpecs: [
    { entry: "spec/core.md" }, 
    { entry: "spec/api.html" }
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

// Access built workspace coreSpecs ASTs
console.log(result.workspaces.coreSpecs);
```

## Next Steps

Check out the [Configuration](/configuration) guide to learn how to structure your specs, or the [API Reference](/api/speculator) for more detailed information.
