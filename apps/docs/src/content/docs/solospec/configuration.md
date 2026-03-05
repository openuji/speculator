---
title: Configuration
description: Discover how to configure Solospec projects and documents
---

Solospec uses a `config.json` file to manage document-level metadata. This configuration file determines how your specification is built, versioned, and attributed.

By default, Solospec will search for `config.json` in the same directory as the document entry-point.

## Configuration Schema

The `config.json` file can include either a `bikeshed` or `respec` object for specifying document metadata, as well as root-level overrides.

### The `id` Field

The document `id` is a core identifier used internally (e.g., for cross-reference slugs and URLs). However, **you do not need to provide it in your `config.json`**. If omitted, Solospec will automatically generate one based on the directory or file name. For a single-document setup, it's safe and recommended to omit it.

### Example: Bikeshed Configuration

If you are migrating from Bikeshed or prefer its metadata terminology, you can provide configuration via the `bikeshed` property. The keys correspond to standard Bikeshed metadata headers (with or without spaces, case-insensitive).

```json
{
  "bikeshed": {
    "Title": "Solid-OIDC",
    "Shortname": "solid-oidc",
    "Level": 1,
    "Status": "CG-DRAFT",
    "Group": "solidcg",
    "ED": "https://solid.github.io/solid-oidc/",
    "TR": "https://solidproject.org/TR/oidc",
    "!Created": "July 16, 2021",
    "!Modified": "[DATE]",
    "Repository": "https://github.com/solid/solid-oidc",
    "Max ToC Depth": 2,
    "Editor": [
      "[Aaron Coburn](https://people.apache.org/~acoburn/#i) ([Inrupt](https://inrupt.com))",
      "[elf Pavlik](https://elf-pavlik.hackers4peace.net)"
    ],
    "Former Editor": [
      "[Adam Migus](https://migusgroup.com/about/) ([The Migus Group](https://migusgroup.com/))"
    ]
  }
}
```

### Example: ReSpec Configuration

If you prefer ReSpec's configuration schema, you can use the `respec` object:

```json
{
  "respec": {
    "title": "My Specification",
    "shortName": "my-spec",
    "specStatus": "ED",
    "editors": [
      {
        "name": "Jane Doe",
        "url": "https://example.com/~jane",
        "company": "Example Corp",
        "companyUrl": "https://example.com"
      }
    ],
    "publishDate": "2024-01-01",
    "github": {
      "repoUrl": "https://github.com/example/my-spec"
    }
  }
}
```

## How Configuration is Resolved

Solospec implements a fallback and normalization mechanism that maps all provided data into a unified, agnostic AST metadata format.

1. **Root Configuration Properties**: Values placed directly at the root of `config.json` (such as `title`, `lastUpdateDate`, `repository`) take the highest precedence.
2. **Format-Specific Configurations**: Both `bikeshed` and `respec` object properties dynamically resolve to their AST equivalents:
   - `bikeshed.ed` or `respec.thisVersion` map to the current identifier URL.
   - `bikeshed.status` or `respec.specStatus` map to `maturityLevel`.
3. **Editor Parsing**: Editor arrays provided as Bikeshed markdown links (e.g. `[Name](URL) ([Company](URL))`) are automatically parsed into robust editor objects in the AST.

---

### Dates and Dynamic Values

Special tokens such as `[DATE]` can be utilized in your configuration files to automatically inject current information contextually at build-time. For example:

```json
{
  "bikeshed": {
    "!Modified": "[DATE]"
  }
}
```
