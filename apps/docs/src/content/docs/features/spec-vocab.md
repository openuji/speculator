---
title: Spec Vocab
description: Generate normative prose directly from RDF vocabularies and JSON-LD contexts.
---

The `<spec-vocab>` element allows you to automatically generate normative tables and requirement statements from pre-existing vocabulary files (such as Turtle `.ttl` or `.jsonld` files) located alongside your specification source.

This ensures your specification’s normative prose is always perfectly synced with your machine-readable vocabulary definitions.

## Term Extraction

You can generate prose for a specific term (class or property) using one of the targeting attributes:

```html
<spec-vocab term="ex:MyClass"></spec-vocab>
<!-- or explicit class IRI -->
<spec-vocab classIri="http://example.org/ns#MyClass"></spec-vocab>
<!-- or targeting a property -->
<spec-vocab property="ex:myProperty"></spec-vocab>
```

When targeting a **Class** (using `term` or `classIri`), Speculator will find the class in your `.ttl` or `.jsonld` side files and generate:

- A description (from `rdfs:comment` or `description`).
- A normative table listing the properties that apply to that class (extracted via `rdfs:domain` or SHACL shapes like `sh:targetClass` and `sh:property`), including their constraints, types, and cardinality.

When targeting a **Property**, it will generate:

- A description.
- A normative table listing its IRI, Label, Domain, Range, and SHACL Target Classes.

### Fallback Class

You can also use the standard HTML `class` attribute as a fallback to target a vocabulary term if it looks like an IRI or prefixed name:

```html
<spec-vocab class="ex:MyClass fallback-style"></spec-vocab>
```

## JSON-LD Contexts

You can generate normative requirements for how to interpret a JSON-LD Context file using the `context` attribute.

```html
<spec-vocab context="my-context"></spec-vocab>
<!-- or use the default context for the document -->
<spec-vocab context></spec-vocab>
```

If you specify a name (e.g., `context="my-context"`), Speculator looks for a side file named `my-context.context.jsonld`.
If you omit the value or just use `context`, Speculator will look for a context file named after the document's parent folder (e.g., `folderName.context.jsonld`). If that doesn't exist but there is exactly one `.context.jsonld` file available alongside your document, it will use that one as the default.

It then resolves any `@import` statements, flattens the context, and generates prose detailing:

- The `@vocab` namespace.
- Prefix expansions.
- Term type coercions (like `@id` or `@json`).
- Container types (like `@set`).

### Expanding IRIs

By default, the generated context prose shows the IRIs exactly as they are written in the JSON-LD context file. If you want to show fully expanded IRIs (resolving any defined prefixes within the generated prose), simply add the `data-expanded-iri` attribute:

```html
<spec-vocab context="my-context" data-expanded-iri></spec-vocab>
```

## Side Files

For `<spec-vocab>` to work correctly, you must place your vocabulary defining files (`.ttl` or `.jsonld`) in the same directory as your Markdown specification document. Speculator automatically loads these "side files" during preprocessing and uses them as the source of truth for all generated prose.
