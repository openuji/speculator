# Pre-Submit Checklist

## Repository and installability

1. Move `apps/astro-demo` to a standalone public template repository, or expose it via a dedicated template branch.
2. Replace `@openuji/speculator: "workspace:*"` in `/Users/zavalit/Projects/openuji/speculator/apps/astro-demo/package.json` with a published semver version.
3. Verify clean install in a fresh directory:
   - `npm create astro@latest -- --template <org>/<repo>`
   - `npm install`
   - `npm run build`

## Project metadata

1. Set real `site` in `/Users/zavalit/Projects/openuji/speculator/apps/astro-demo/astro.config.mjs`.
2. Confirm README quick start and customization docs are accurate.
3. Confirm license file and copyright owner are final.

## UX and quality

1. Validate light and dark modes on desktop and mobile.
2. Validate nav, TOC links, and playground rendering.
3. Validate Mermaid diagrams render in both themes.
4. Run final build and preview.

## Submission payload

1. Fill real URLs in `submission-pack/portal-copy.md` and `submission-pack/theme-metadata.json`.
2. Export screenshots listed in `submission-pack/asset-shotlist.md`.
3. Paste final copy and upload assets in Astro Portal: https://portal.astro.build/
