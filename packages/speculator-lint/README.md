# @openuji/speculator-lint

**Developer-grade linting for technical specifications.**

`speculator-lint` brings the rigor of code quality tools to the world of technical authoring. It analyzes the [Speculator AST](../speculator) to catch conceptual errors that standard spellcheckers and Markdown linters miss.

## 🎯 Key Rules

- **Workspace Consistency**: Ensures terms defined in high-level specs aren't accidentally redefined in lower-level "extension" specs.
- **Dependency Integrity**: Prevents "reverse dependencies" (e.g., a core spec referencing concepts that only exist in a plugin).
- **Semantic Validation**: Verifies that all cross-references (xref) point to valid definitions (dfn).

## 🚀 Usage

### CLI

```bash
# Lint your specification workspace
speculator-lint workspace.json
```

### Config (`.speculatorlintrc.json`)

```json
{
  "extends": ["recommended"],
  "rules": {
    "workspace/no-redefinition": "error",
    "workspace/no-reverse-dependency": "warning"
  }
}
```

## 🛠️ Extensibility

You can create custom lint rules by implementing the `LintRule` interface, allowing you to enforce project-specific style guides or technical constraints across your entire spec suite.

---

Part of the [Speculator](../../README.md) ecosystem.
