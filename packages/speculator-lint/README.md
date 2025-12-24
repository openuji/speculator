# @openuji/speculator-lint

Standalone linter for [Speculator](../speculator) workspace AST with configurable validation rules.

## Installation

```bash
pnpm add -D @openuji/speculator-lint
```

## Usage

### CLI

Lint a workspace AST file:

```bash
speculator-lint workspace.json
```

With custom configuration:

```bash
speculator-lint workspace.json --config .speculatorlintrc.json
```

### Programmatic API

```typescript
import { readFileSync } from 'fs';
import { SpeculatorLinter, builtInRules, recommendedConfig } from '@openuji/speculator-lint';

// Load workspace AST
const workspace = JSON.parse(readFileSync('workspace.json', 'utf-8'));

// Build document levels map
const documentLevels = new Map();
workspace.documents.forEach((doc, index) => {
  documentLevels.set(doc.sourcePos?.file || '', index);
});

// Create linter with built-in rules
const linter = new SpeculatorLinter(builtInRules);

// Run linter
const result = await linter.lint({
  workspace,
  documentLevels,
  config: recommendedConfig
});

// Check results
if (result.hasErrors) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.message);
  }
}
```

## Configuration

Create a `.speculatorlintrc.json` file in your project root:

```json
{
  "extends": ["recommended"],
  "rules": {
    "workspace/no-redefinition": "error",
    "workspace/no-reverse-dependency": "warning"
  }
}
```

### Rule Configuration

Rules can be configured with:
- `"off"` - Disable the rule
- `"error"` - Report as error
- `"warning"` - Report as warning
- `"info"` - Report as info

### Extends

Use `"extends": ["recommended"]` to enable all built-in rules with their default severities.

## Built-in Rules

### workspace/no-redefinition

Ensures that lower-level specs do not redefine concepts from higher-level specs.

**Rationale:** In a hierarchical specification system, higher-level specs define the core vocabulary. Lower-level specs should extend, not override these definitions.

**Example violation:**

```
core.md (level 0): defines "User"
extension.md (level 1): defines "User" again  ← ERROR
```

### workspace/no-reverse-dependency

Ensures that higher-level specs do not depend on (reference) lower-level specs.

**Rationale:** Dependencies should flow downward in the hierarchy. Higher-level specs should be self-contained and not rely on lower-level implementation details.

**Example violation:**

```
core.md (level 0): references "DetailedConfig"
extension.md (level 1): defines "DetailedConfig"  ← ERROR
```

## Creating Custom Rules

You can create custom rules by implementing the `LintRule` interface:

```typescript
import type { LintRule } from '@openuji/speculator-lint';

export const myCustomRule: LintRule = {
  meta: {
    name: 'my-custom-rule',
    code: 'my-custom-rule',
    severity: 'warning',
    description: 'My custom validation rule',
    category: 'custom'
  },
  
  create(context) {
    return {
      // Called for each definition
      onDefinition(entry, allEntriesForTerm) {
        // Your validation logic
        if (/* some condition */) {
          context.report({
            message: 'Issue found',
            file: entry.sourcePos?.file,
            sourcePos: entry.sourcePos
          });
        }
      },
      
      // Called for each reference
      onReference(ref, target) {
        // Your validation logic
      },
      
      // Called once per document
      onDocument(doc) {
        // Your validation logic
      }
    };
  }
};

// Use with linter
const linter = new SpeculatorLinter([...builtInRules, myCustomRule]);
```

## API Reference

### SpeculatorLinter

Main linter class.

```typescript
class SpeculatorLinter {
  constructor(rules: LintRule[]);
  lint(options: LintOptions): Promise<LintResult>;
  getRules(): LintRule[];
}
```

### Types

- `LintRule` - Rule interface
- `LintContext` - Context provided to rules
- `LintVisitor` - Visitor pattern for AST traversal
- `LintDiagnostic` - Diagnostic output
- `LintResult` - Lint result with diagnostics
- `LintConfig` - Configuration schema

## License

MIT
