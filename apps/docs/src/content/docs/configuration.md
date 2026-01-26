---
title: Configuration
description: Detailed guide to Speculator configuration, including core settings and ReSpec compatibility.
---

Speculator uses a `config.json` file located sibling to each specification entry file (e.g., `index.md` or `index.html`) to define its metadata, dependencies, and processing options.

## Config Structure

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
  },
  "custom": {
    "myCustomField": "value",
    "analytics": { "enabled": true }
  }
}
```

## Principle of Priority

Speculator enforces a strict **Priority Override** rule with three layers:

> [!IMPORTANT]
> **Priority Order (lowest → highest):**
>
> 1. `respec.*` - ReSpec-compatible fallback settings
> 2. Root-level properties (`title`, `lastUpdateDate`, `maturityLevel`) - Override respec
> 3. `custom.*` - **Highest priority**, overwrites everything

This allows you to maintain ReSpec compatibility for traditional spec metadata while using the root level for Speculator-specific overrides, and `custom` for any user-defined properties that must take precedence.

### Example: Update Dates

The `lastUpdateDate` field follows this priority:

1. **Root `lastUpdateDate`**: Highest priority. If set, this value is used in the AST.
2. **`respec.modificationDate`**: Fallback level. Used only if the root setting is missing.

In the example above, the resulting AST will have `lastUpdateDate: "2026-01-11"`, completely ignoring the older `modificationDate` in the `respec` block.

### Example: Maturity Level

The `maturityLevel` field follows the same priority pattern:

1. **Root `maturityLevel`**: Highest priority. Accepts values: `incubating`, `draft`, `prerelease`, `stable`.
2. **Mapped `respec.specStatus`**: Fallback. ReSpec status codes are automatically mapped:
   - `ED`, `WD`, `FPWD` → `draft`
   - `CR`, `PR`, `LCWD` → `prerelease`
   - `REC`, `NOTE`, `CG-FINAL` → `stable`
   - `unofficial`, `CG-DRAFT` → `incubating`

In the example above, `maturityLevel: "stable"` overrides the implied `draft` from `specStatus: "ED"`.

### Example: Title

The `title` field also follows the priority pattern:

1. **Root `title`**: Highest priority. If set, this becomes the document title.
2. **`respec.title`**: Fallback. Used only if root `title` is missing.

In the example above, the document will use `"My Awesome Specification"` from the root, ignoring `"Fallback Title"` in the respec block.

---

## Core Settings

| Setting          | Type       | Description                                                                                                                |
| :--------------- | :--------- | :------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`   | Unique identifier for the document within a workspace. If omitted, one is auto-generated from the parent folder name.      |
| `title`          | `string`   | **Priority** document title. Overwrites `respec.title`.                                                                    |
| `deps`           | `string[]` | List of document IDs that this document depends on. They will be processed first.                                          |
| `lastUpdateDate` | `string`   | **Priority** last update date (ISO 8601: `YYYY-MM-DD`). Overwrites `respec.modificationDate`.                              |
| `maturityLevel`  | `string`   | **Priority** maturity level. One of: `incubating`, `draft`, `prerelease`, `stable`. Overwrites mapped `respec.specStatus`. |
| `custom`         | `object`   | **Highest priority** user-defined properties. Passed through as-is, overwrites any conflicting root or respec values.      |
| `respec`         | `object`   | ReSpec-compatible configuration (see below).                                                                               |

---

## ReSpec Settings

These settings reside within the `respec` object and closely mirror the [ReSpec configuration options](https://respec.org/docs/#configuration-options).

### Document Metadata

| Setting     | Type     | Description                                                           |
| :---------- | :------- | :-------------------------------------------------------------------- |
| `title`     | `string` | **Fallback** title for the specification. Overridden by root `title`. |
| `shortName` | `string` | A URL-friendly short name for the spec.                               |
| `subtitle`  | `string` | An optional subtitle or tagline.                                      |

### Versioning & Status

| Setting            | Type     | Description                                                                            |
| :----------------- | :------- | :------------------------------------------------------------------------------------- |
| `specStatus`       | `string` | Status code (e.g., `ED`, `WD`, `CR`, `REC`). **Fallback** for `maturityLevel` mapping. |
| `publishDate`      | `string` | Formal publication date (ISO 8601: `YYYY-MM-DD`).                                      |
| `modificationDate` | `string` | **Fallback** last update date. Overridden by root `lastUpdateDate`.                    |
| `thisVersion`      | `string` | URL for this version of the spec.                                                      |
| `latestVersion`    | `string` | URL for the latest version.                                                            |
| `prevVersion`      | `string` | URL for the previous version.                                                          |

### Contributors

| Setting   | Type    | Description                                                      |
| :-------- | :------ | :--------------------------------------------------------------- |
| `editors` | `array` | List of person objects containing `name`, `url`, `company`, etc. |
| `authors` | `array` | List of authorship objects, similar to editors.                  |

### Content & Structure

| Setting       | Type      | Description                                             |
| :------------ | :-------- | :------------------------------------------------------ |
| `abstract`    | `string`  | Abstract text if not provided in the document body.     |
| `noTOC`       | `boolean` | If `true`, disables Table of Contents generation.       |
| `maxTocLevel` | `number`  | Maximum depth for the Table of Contents (default: `4`). |
| `license`     | `string`  | License shortname or URL (e.g., `cc-by`).               |

### Branding

| Setting | Type    | Description                                  |
| :------ | :------ | :------------------------------------------- |
| `logos` | `array` | Array of logo objects: `{ src, alt, href }`. |

---

## Technical Details

After loading and normalization, these settings are exposed in the Document AST under `document.metadata`.

Generated TypeScript types can be found in:

- `SpecConfig` ([types.ts](file:///Users/zavalit/Projects/openuji/speculator/packages/speculator/src/preprocess/types.ts))
- `DocumentMetadata` ([ast.generated.ts](file:///Users/zavalit/Projects/openuji/speculator/packages/speculator/src/types/ast.generated.ts))
