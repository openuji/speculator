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

## Next Steps

Check out the [API Reference](/api/speculator) for more detailed information on each package.
