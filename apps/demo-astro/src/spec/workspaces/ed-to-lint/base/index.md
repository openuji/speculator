# Lint Base {#lint-base}

:::include ./partials/context.md :::

## Duplicate Definitions {#duplicate-definitions}

This document defines <dfn id="core-artifact">Core Artifact</dfn>.

It also defines <dfn>Core Artifact</dfn> again to trigger duplicate-definition diagnostics.

## Reverse Dependency Example {#reverse-dependency-example}

The base document references [=extension hook=], which is defined only in a lower-level document.

## Deprecated ID Links {#deprecated-id-links}

- [Legacy markdown jump](#core-artifact)
- <a href="#core-artifact">Legacy HTML jump</a>

## Unresolved References {#unresolved-references}

This unresolved concept should fail: [=ghost concept=].

This citation has no bibliography entry: [[MISSING-BIB]].
