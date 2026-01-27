# @openuji/speculator-lint

**Developer-grade linting for technical specifications.**

`speculator-lint` helps ensure conceptual consistency and semantic integrity in your technical specifications. It catches errors like redefinitions across spec levels, reverse dependencies, and ambiguous references.

## 📖 Documentation

For full documentation on available rules, configuration presets, and extensibility, please visit the [Speculator Documentation](https://speculator.pages.dev/qa/linter).

## 🚀 Quick Start

```bash
# Install
pnpm add -D @openuji/speculator-lint

# Lint your workspace
speculator-lint workspace.json
```

### Basic Config (`.speculatorlintrc.json`)

```json
{
  "extends": ["recommended"]
}
```

---

Part of the [Speculator](https://github.com/openuji/speculator) ecosystem.
