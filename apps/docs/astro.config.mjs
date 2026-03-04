// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypedoc from 'starlight-typedoc';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @param {string} pkg */
const entry = (pkg) => resolve(__dirname, `../../packages/${pkg}/src/index.ts`);
/** @param {string} pkg */
const tsconfig = (pkg) => resolve(__dirname, `../../packages/${pkg}/tsconfig.json`);

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Speculator',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/openuji/speculator' }],
			plugins: [
				starlightTypedoc({
					entryPoints: [entry('speculator')],
					output: 'api/speculator',
					tsconfig: tsconfig('speculator'),
					sidebar: {
						collapsed: true,
					},
					typeDoc: {
						flattenOutputFiles: true,
						entryFileName: 'index.md',
						hideBreadcrumbs: true,
						hidePageTitle: true,
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('speculator-lint')],
					output: 'api/speculator-lint',
					tsconfig: tsconfig('speculator-lint'),
					sidebar: {
						collapsed: true,
					},
					typeDoc: {
						flattenOutputFiles: true,
						entryFileName: 'index.md',
						hideBreadcrumbs: true,
						hidePageTitle: true,
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('speculator-search')],
					output: 'api/speculator-search',
					tsconfig: tsconfig('speculator-search'),
					sidebar: {
						collapsed: true,
					},
					typeDoc: {
						flattenOutputFiles: true,
						entryFileName: 'index.md',
						hideBreadcrumbs: true,
						hidePageTitle: true,
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('vocab-build')],
					output: 'api/vocab-build',
					tsconfig: tsconfig('vocab-build'),
					sidebar: {
						collapsed: true,
					},
					typeDoc: {
						flattenOutputFiles: true,
						entryFileName: 'index.md',
						hideBreadcrumbs: true,
						hidePageTitle: true,
						
					}
				}),
			],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Getting Started', slug: 'getting-started' },
						{ label: 'Configuration', slug: 'configuration' },
					],
				},
				{
					label: 'Features',
					autogenerate: { directory: 'features' },
				},
				{
					label: 'Diagrams',
					autogenerate: { directory: 'diagrams' },
				},
				{
					label: 'Solospec',
					autogenerate: { directory: 'solospec' },
				},
				{
					label: 'Quality Assurance',
					autogenerate: { directory: 'qa' },
				},
				{
					label: 'API Reference',
					items: [
						{ label: '@openuji/speculator', autogenerate: { directory: 'api/speculator', collapsed: true } },
						{ label: '@openuji/speculator-lint', autogenerate: { directory: 'api/speculator-lint', collapsed: true } },
						{ label: '@openuji/speculator-search', autogenerate: { directory: 'api/speculator-search', collapsed: true } },
						{ label: '@openuji/vocab-build', autogenerate: { directory: 'api/vocab-build', collapsed: true } },
					],
				},
			],
		}),
	],
});
