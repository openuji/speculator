# Speculator Studio Theme (`apps/astro-demo`)

A fresh Astro theme starter built for eventual submission to the Astro Theme Catalog, with a working Speculator renderer playground.

## Quick start

```bash
pnpm install
pnpm --filter apps-astro-demo dev
```

Build check:

```bash
pnpm --filter apps-astro-demo build
```

## Project structure

```text
apps/astro-demo/
├── public/
├── src/
│   ├── components/
│   │   ├── renderers/
│   │   └── ui/
│   ├── spec/
│   ├── layouts/
│   ├── lib/
│   ├── pages/
│   ├── styles/
│   └── theme/
├── astro.config.mjs
├── package.json
└── tsconfig.json
```

## Renderer integration

- `src/components/renderers/BlockRenderer.astro` recursively renders Speculator `Block` / `Section` nodes.
- `src/components/renderers/InlineRenderer.astro` recursively renders Speculator inline nodes.
- `src/components/ui/*` are local, composable UI primitives used as renderer blocks (`Badge`, `Panel`, `Callout`, `CodeBlock`).
- `src/lib/load-demo-spec.ts` runs Speculator with `corePlugins` on local sample content in `src/spec`.
- The theme automatically follows system light/dark mode (`prefers-color-scheme`), including Mermaid diagrams.

## Styling architecture

- Tailwind v4 is integrated via `@tailwindcss/vite` in `astro.config.mjs`.
- Design tokens live in CSS custom properties and are mapped into Tailwind using `@theme inline`.
- `src/styles/theme.css` defines reusable utilities (`@utility`) and component layers (`@layer`) to keep templates concise.

## Astro Theme Catalog research notes (2026-02-09)

Public Astro pages do not currently publish a full, standalone "theme requirements" checklist in docs. The current flow is:

- Theme submission happens via Astro Portal with GitHub auth: [portal.astro.build](https://portal.astro.build/).
- Astro catalog states anyone can submit a theme from the themes page: [astro.build/themes](https://astro.build/themes).
- Live catalog entries expose common fields you should prepare up front: title, summary, long description, tags/category context, live demo URL, and "Get Started" install flow from a repo template.

Useful references:

- [Astro Themes catalog](https://astro.build/themes)
- [Astro Portal](https://portal.astro.build/)
- [Theme detail example (what listing fields look like)](https://astro.build/themes/details/astrolite/)
- [Create Astro with a GitHub template repo](https://docs.astro.build/en/install-and-setup/#start-a-new-project)

## Submission-ready checklist for this starter

- Update `astro.config.mjs` `site` to your production URL.
- Add your final repository URL, demo URL, and screenshots.
- Keep this README aligned with your customization/install steps.
- Confirm mobile and desktop layouts in real content pages.
- Ensure open-source licensing and contributor metadata are explicit.

## Submission pack

- Ready-to-use submission assets and copy are in `submission-pack/`.
- Start with `submission-pack/README.md`, then fill placeholders in `submission-pack/portal-copy.md` and `submission-pack/theme-metadata.json`.

## Notes

This app is intentionally independent from `apps/demo` so you can migrate content later without carrying over the old structure.
