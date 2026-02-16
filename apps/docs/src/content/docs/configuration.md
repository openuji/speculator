---
title: Configuration
description: Detailed guide to Speculator configuration, including core settings and ReSpec compatibility.
---

Speculator configuration is handled at two levels: **Workspace** level (discovering multiple specifications) and **Document** level (defining metadata for a single specification).

---

## Workspace Configuration

Workspace configuration defines how Speculator finds and groups your specifications. A workspace corresponds to a collection of documents that share a namespace and can refer to each other.

Workspace configuration is typically defined in a `speculator.workspace.json` file or passed as the `entryMap` to `buildWorkspaces`.

### Structure

Workspace configuration is a mapping of workspace names to their definitions. Definitions can be **explicit entries**, **directory shorthands**, or **glob patterns**.

```json
{
  "api-workspace": "spec/api", // Directory shorthand
  "md-group": "spec/md/**/*.md", // Glob pattern
  "explicit-ws": [
    { "entry": "spec/core/index.html" },
    { "entry": "spec/utils/index.md" }
  ]
}
```

### Discovery Shorthands

#### 1. Directory Shorthand

If a workspace value is a plain directory path (e.g., `"spec/workspace"`), Speculator recursively scans that directory for entry files following a naming convention.

**Convention-based Discovery:**
Speculator looks for files named `index.html` or `index.md` in all subdirectories. Each discovered file is added as a document entry in the workspace.

#### 2. Glob Patterns

Speculator supports full glob patterns for file discovery.

- `*` : Matches any number of characters except `/`.
- `**`: Matches any number of characters including `/` (recursive matching).
- `?` : Matches a single character.
- `{a,b}`: Matches either `a` or `b`.

**Automatic Conventions in Globs:**

- If a glob pattern ends in `/` or `**`, Speculator automatically appends `index.{html,md}` logic to find specification entries within those directories.
- Example: `"spec/**/"` expands to `"spec/**/index.{html,md}"`.

### Explicit Entries

For precise control, you can provide an array of entry objects.

| Property     | Type     | Description                                                                                     |
| :----------- | :------- | :---------------------------------------------------------------------------------------------- |
| `entry`      | `string` | Path to the specification entry file (`.md` or `.html`) or a folder containing `index.md/html`. |
| `configPath` | `string` | (Optional) Explicit path to a configuration file, overriding the default `config.json` lookup.  |

---

## Document Configuration

Each specification entry file (e.g., `index.md` or `index.html`) follows a convention to find its document-level metadata. By default, Speculator looks for a `config.json` file in the same directory.

### Config Structure

The configuration follows a dual-layered structure: **Core Settings** at the root level and **ReSpec Settings** within a nested `respec` object.

```json
{
  "id": "my-specification",
  "title": "My Awesome Specification",
  "lastUpdateDate": "2026-01-11",
  "maturityLevel": "stable",
  "deps": ["core-spec"],
  "respec": {
    "title": "Fallback Title",
    "shortName": "my-spec",
    "specStatus": "ED",
    "modificationDate": "2026-01-10"
  }
}
```

### Principle of Priority

Speculator enforces a strict **Priority Override** rule with three layers:

> [!IMPORTANT]
> **Priority Order (lowest → highest):**
>
> 1. `respec.*` - ReSpec-compatible fallback settings
> 2. Root-level properties (`title`, `lastUpdateDate`, `maturityLevel`) - Override respec
> 3. `custom.*` - **Highest priority**, overwrites everything

### Core Settings

| Setting          | Type       | Description                                                                                                                |
| :--------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`   | Unique identifier for the document. If omitted, one is auto-generated from the parent folder name.                         |
| `title`          | `string`   | **Priority** document title. Overwrites `respec.title`.                                                                    |
| `deps`           | `string[]` | List of document IDs that this document depends on. They will be processed first.                                          |
| `baseUrl`        | `string`   | Base URL for statement IRIs. Combined with `id` to form full URLs.                                                         |
| `lastUpdateDate` | `string`   | **Priority** last update date (ISO 8601: `YYYY-MM-DD`). Overwrites `respec.modificationDate`.                              |
| `maturityLevel`  | `string`   | **Priority** maturity level. One of: `incubating`, `draft`, `prerelease`, `stable`. Overwrites mapped `respec.specStatus`. |
| `custom`         | `object`   | **Highest priority** user-defined properties. Passed through as-is.                                                        |
| `respec`         | `object`   | ReSpec-compatible configuration.                                                                                           |

### ReSpec Settings

These settings reside within the `respec` object and closely mirror [ReSpec options](https://respec.org/docs/#configuration-options).

| Category     | Settings                                                                                 |
| :----------- | :--------------------------------------------------------------------------------------- |
| **Metadata** | `title` (fallback), `shortName`, `subtitle`                                              |
| **Status**   | `specStatus` (fallback for maturity), `publishDate`, `modificationDate`, `latestVersion` |
| **People**   | `editors` (array), `authors` (array)                                                     |
| **Content**  | `abstract`, `noTOC`, `maxTocLevel`, `license`                                            |

---

## Environment Variables

Speculator supports environment variable interpolation in `config.json` files.

### Syntax

- `${SPEC_VARIABLE_NAME}`
- `$SPEC_VARIABLE_NAME`

> [!IMPORTANT]
> **Security Restriction:** For security reasons, Speculator only interpolates variables starting with the `SPEC_` prefix.

### Framework Integration (Astro/Vite)

In frameworks like Astro, variable injection must be explicit:

```typescript
const buildResult = await buildWorkspaces({
  entryMap: workspaceMap,
  env: import.meta.env, // Inject Astro/Vite environment
});
```

---

## Technical Details

- **Isomorphic Discovery**: Custom `FileProvider` implementations must provide `readdir?(path: string, options?: { recursive?: boolean }): Promise<string[]>` to support folder and glob discovery.
- **AST Mapping**: Configuration is exposed in the Document AST under `document.metadata`.
- **Typing**: See `SpecConfig` and `WorkspaceEntryMap` in [preprocess/types.ts](https://github.com/openuji/speculator/blob/main/packages/speculator/src/preprocess/types.ts).
