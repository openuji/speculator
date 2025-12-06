# AGENTS.md - Architectural Guidelines for AI Coding Agents

This document outlines the architectural patterns and constraints that **MUST** be preserved when making changes to this codebase. AI agents should treat these as strict guidelines.

---

## Core Architectural Principles

### 1. TypeScript Strictness

**NEVER** disable or weaken TypeScript strict mode settings.

The project uses strict TypeScript configuration in `tsconfig.json`:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "exactOptionalPropertyTypes": true
}
```

✅ **DO:**
- Define explicit types for all function parameters and return values
- Use interfaces for all public contracts
- Export types alongside implementations

❌ **DON'T:**
- Use `any` type (use `unknown` if type is truly unknown)
- Add `@ts-ignore` or `@ts-expect-error` comments
- Disable strict checks per-file

---

### 2. Separation of Concerns

The codebase follows a layered architecture. Respect these boundaries:

```
┌─────────────────────────────────────────────┐
│            Speculator (Orchestrator)        │
├─────────────────────────────────────────────┤
│  DocumentBuilder  │  PipelineRunner         │
├───────────────────┼─────────────────────────┤
│    Processors     │    Pipeline Passes      │
├───────────────────┼─────────────────────────┤
│               Utilities / Utils             │
└─────────────────────────────────────────────┘
```

✅ **DO:**
- Keep orchestration logic in `Speculator` class
- Put DOM traversal/processing in `processors/`
- Put post-render transformations in `pipeline/passes/`
- Put shared helpers in `utils/`

❌ **DON'T:**
- Add DOM manipulation to utility functions
- Call pipeline passes directly from processors
- Mix file I/O with content transformation
- Add business logic to renderers

---

### 3. Strategy Pattern for Format Processing

All content format conversions go through `FormatRegistry`. 

**Location:** `src/format-registry.ts`

✅ **DO:**
- Implement `FormatStrategy` interface for new formats
- Register strategies via `FormatRegistry.register()`
- Keep conversion logic pure (input string → output string)

```typescript
// Correct way to add a new format
class MyFormatStrategy implements FormatStrategy {
  convert(content: string): string {
    return transformedContent;
  }
}

registry.register('my-format', new MyFormatStrategy());
```

❌ **DON'T:**
- Handle format conversion outside the registry
- Add format-specific logic to `IncludeProcessor` or `FormatProcessor`
- Create format handlers that have side effects

---

### 4. Pipeline Pass Pattern (Functional Composition)

All post-processing logic MUST be implemented as pipeline passes using **functional composition**.

**Location:** `src/pipeline/passes/`

Each pass MUST:
1. Implement `PipelinePass` interface
2. Return a `PassResult` containing its output and merged downstream results
3. Call `next()` to get downstream results, then merge its own output

```typescript
export class MyPass implements PipelinePass {
  name = 'my-pass';  // Optional, for debugging/filtering
  
  constructor(private readonly root: Element) {}
  
  async run(
    _root: Element,
    config: SpeculatorConfig,
    next: () => Promise<PassResult>
  ): Promise<PassResult> {
    // 1. Do your work
    const myOutput = doProcessing(this.root, config);
    const myWarnings = ['warning if any'];
    
    // 2. Get downstream results
    const downstream = await next();
    
    // 3. Merge and return
    return {
      ...downstream,
      myOutputKey: myOutput,  // Add your output under any key
      warnings: [...myWarnings, ...downstream.warnings],
    };
  }
}
```

✅ **DO:**
- Return `PassResult` with your output merged with downstream
- Call `next()` to compose with downstream passes
- Add your output under a descriptive key (e.g., `toc`, `references`, `assertions`)
- Register new passes in the default pass factory in `Speculator`

❌ **DON'T:**
- Use shared mutable state (no `ctx` object)
- Skip calling `next()` without clear short-circuit intent
- Add post-processing logic outside pipeline passes

---

### 5. Processor Interface Contract

Element processors follow the `ElementProcessor` interface.

**Location:** `src/processors/element-processor.ts`

```typescript
interface ElementProcessor {
  matches(element: Element): boolean;
  process(element: Element, tracker: StatsTracker, warnings: string[]): Promise<ProcessorResult>;
}
```

✅ **DO:**
- Return `{ content, error }` - never throw
- Track stats via `StatsTracker` methods
- Remove processed `data-*` attributes after handling

❌ **DON'T:**
- Create new processor types without implementing the interface
- Throw exceptions from `process()` method
- Leave `data-include` or `data-format` attributes after processing

---

### 6. Environment Agnostic Design

The library supports both browser and Node.js environments.

**Entry Points:**
- `src/browser.ts` - Browser environment (uses native DOMParser)
- `src/node.ts` - Node.js environment (uses linkedom)

✅ **DO:**
- Use `HtmlRenderer` abstraction for DOM operations
- Check environment capabilities at configuration time
- Keep optional dependencies (`linkedom`, `mermaid`) truly optional

❌ **DON'T:**
- Use `window` or `document` globals directly
- Assume `DOMParser` or `fetch` are available
- Import Node.js built-ins in browser entry point

---

### 7. Extension Points

The architecture provides these extension points. Use them instead of modifying core:

| Extension Point | Use Case |
|-----------------|----------|
| `options.passes` | Custom pipeline passes |
| `options.formatRegistry` | Custom format strategies |
| `options.fileLoader` | Custom file loading logic |
| `options.htmlRenderer` | Custom DOM implementation |
| `config.postProcess` | Post-render hooks |
| `config.preProcess` | Pre-render hooks |

---

### 8. Test Pattern Requirements

All new features MUST include tests.

**Location:** `tests/`

✅ **DO:**
- Use Jest with `@jest/globals` imports
- Mock file loaders for isolation
- Test both success and error paths
- Include integration tests for pipeline passes

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';

describe('MyFeature', () => {
  it('should handle expected input', async () => {
    // ...
  });
  
  it('should warn on invalid input', async () => {
    // ...
  });
});
```

---

### 9. Markdown Plugin Pattern

Markdown extensions use the markdown-it plugin system.

**Location:** `src/markdown/plugins/`

Existing plugins:
- `concept.ts` - `[= term =]` syntax
- `idl.ts` - `{{ IDL }}` syntax  
- `cite.ts` - `[[reference]]` syntax
- `mermaid.ts` - Mermaid diagram rendering

✅ **DO:**
- Follow markdown-it plugin conventions
- Register plugins in `createMarkdownRenderer()`
- Keep plugins focused on syntax transformation

---

### 10. Type Exports

All public types MUST be exported from `src/index.ts`.

✅ **DO:**
- Export types with `export type { ... }`
- Export classes/functions with `export { ... }`
- Group related exports together

---

## Quick Reference: File Ownership

| Directory | Owner/Purpose |
|-----------|--------------|
| `src/speculator.ts` | Main orchestrator - avoid adding logic here |
| `src/processors/` | `data-*` attribute handling |
| `src/pipeline/passes/` | Post-processing transformations |
| `src/renderers/` | HTML output generation |
| `src/markdown/` | Markdown parsing and plugins |
| `src/xref/` | Cross-reference resolution |
| `src/utils/` | Shared utilities only |

---

## Before Submitting Changes

1. ✅ `pnpm test` passes
2. ✅ `pnpm build` succeeds  
3. ✅ No new TypeScript errors
4. ✅ Types exported if public
5. ✅ Tests added for new features
6. ✅ Follows patterns documented above
