---
title: Speculator Linter
description: Developer-grade linting for technical specifications.
---

`speculator-lint` brings the rigor of code quality tools to the world of technical authoring. It analyzes the [Speculator AST](/api/speculator) to catch conceptual errors that standard spellcheckers and Markdown linters miss.

## 🎯 Key Rules

### Workspace Rules

- **`workspace/no-redefinition`** (Error): Prevents lower-level specs from redefining terms already defined in higher-level specs.
- **`workspace/no-reverse-dependency`** (Error): Ensures higher-level specs do not depend on lower-level specs, maintaining a clear hierarchy.

### Document Rules

- **`document/no-duplicate-definition`** (Error): A single document must not define the same term or alias multiple times.

### Reference Rules

- **`reference/no-ambiguous-reference`** (Warning): Flags references that resolve to multiple definitions. Use `data-link-for` to disambiguate.
- **`reference/no-id-reference`** (Warning): Discourages hardcoded ID-based references (e.g., `href="#my-id"`). Use the semantic [Context Pattern](/features/references) instead.

## 🚀 Usage

### CLI

```bash
# Lint your specification workspace
speculator-lint workspace.json
```

### Configuration (`.speculatorlintrc.json`)

Speculator Lint supports configuration inheritance via the `extends` property.

```json
{
  "extends": ["recommended"],
  "rules": {
    "reference/no-id-reference": "error"
  }
}
```

- **`"extends": ["recommended"]`**: Enables all built-in rules with their standard severities. This is the baseline for most projects.
- **Rule Overrides**: You can override specific rules from the preset by defining them in the `rules` object. Setting a rule to `"off"` will disable it entirely.

#### What's in `recommended`?

The `recommended` preset includes the following rules:

| Rule                               | Severity  |
| :--------------------------------- | :-------- |
| `workspace/no-redefinition`        | `error`   |
| `workspace/no-reverse-dependency`  | `error`   |
| `document/no-duplicate-definition` | `error`   |
| `reference/no-ambiguous-reference` | `warning` |
| `reference/no-id-reference`        | `warning` |

## 🛠️ Extensibility

You can create custom lint rules by implementing the `LintRule` interface, allowing you to enforce project-specific style guides or technical constraints across your entire spec suite.
