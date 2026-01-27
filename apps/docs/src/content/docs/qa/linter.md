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

## 📁 Workspace Configuration

For projects with multiple isolated specification groups (e.g., separate "core" and "addons" projects), you can use a `speculator.workspace.json` file as a named map. This ensures each group is built as its own isolated AST, preventing term or ID leakage between groups.

```json
{
  "coreSpecs": [
    { "entry": "spec/core.md" }, 
    { "entry": "spec/api.html" }
  ],
  "addonSpecs": [
    { "entry": "addons/ui/index.md" },
    { "entry": "addons/storage/index.md" }
  ]
}
```

Usage with workspace config:

```bash
speculator-lint speculator.workspace.json
```

## ⚓ Husky / Lint-staged Integration

To ensure your specifications remain valid before every commit, you can integrate `speculator-lint` with `husky` and `lint-staged`.

Because Speculator uses a cross-document resolution engine, the linter **always checks the entire workspace** even if only a single file is being committed. This ensures that a change in one file doesn't break references in another.

### Example `package.json` Setup

```json
{
  "lint-staged": {
    "spec/**/*.md": ["speculator-lint speculator.workspace.json"]
  }
}
```

When you attempt to commit a Markdown file, `lint-staged` will trigger the linter. The linter will build the full workspace context, perform high-level validation, and block the commit if any errors (like redefinitions or broken references) are found.

## 🛠️ Extensibility

You can create custom lint rules by implementing the `LintRule` interface, allowing you to enforce project-specific style guides or technical constraints across your entire spec suite.
