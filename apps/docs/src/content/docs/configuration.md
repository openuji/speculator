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
  "lastUpdateDate": "2026-01-11",
  "deps": ["core-spec"],
  "respec": {
    "title": "My Awesome Specification",
    "shortName": "my-spec",
    "modificationDate": "2026-01-10"
  }
}
```

## Principle of Priority

Speculator enforces a strict **Priority Override** rule:

> [!IMPORTANT] > **Core settings at the root level always overwrite corresponding settings within the `respec` object.**

This allows you to maintain ReSpec compatibility for traditional spec metadata while using the root level for Speculator-specific overrides or programmatic updates.

### Example: Update Dates

The `lastUpdateDate` field follows this priority:

1. **Root `lastUpdateDate`**: Highest priority. If set, this value is used in the AST.
2. **`respec.modificationDate`**: Fallback level. Used only if the root setting is missing.

In the example above, the resulting AST will have `lastUpdateDate: "2026-01-11"`, completely ignoring the older `modificationDate` in the `respec` block.

---

## Core Settings

| Setting          | Type       | Description                                                                                                  |
| :--------------- | :--------- | :----------------------------------------------------------------------------------------------------------- |
| `id`             | `string`   | Unique identifier for the document within a workspace. If omitted, one is auto-generated from the file path. |
| `deps`           | `string[]` | List of document IDs that this document depends on. They will be processed first.                            |
| `lastUpdateDate` | `string`   | **Priority** last update date (ISO 8601: `YYYY-MM-DD`). Overwrites `respec.modificationDate`.                |
| `respec`         | `object`   | ReSpec-compatible configuration (see below).                                                                 |

---

## ReSpec Settings

These settings reside within the `respec` object and closely mirror the [ReSpec configuration options](https://respec.org/docs/#configuration-options).

### Document Metadata

| Setting     | Type     | Description                             |
| :---------- | :------- | :-------------------------------------- |
| `title`     | `string` | The title of the specification.         |
| `shortName` | `string` | A URL-friendly short name for the spec. |
| `subtitle`  | `string` | An optional subtitle or tagline.        |

### Versioning & Status

| Setting            | Type     | Description                                                         |
| :----------------- | :------- | :------------------------------------------------------------------ |
| `specStatus`       | `string` | Status code (e.g., `ED`, `WD`, `CR`, `REC`).                        |
| `publishDate`      | `string` | Formal publication date (ISO 8601: `YYYY-MM-DD`).                   |
| `modificationDate` | `string` | **Fallback** last update date. Overridden by root `lastUpdateDate`. |
| `thisVersion`      | `string` | URL for this version of the spec.                                   |
| `latestVersion`    | `string` | URL for the latest version.                                         |
| `prevVersion`      | `string` | URL for the previous version.                                       |

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
