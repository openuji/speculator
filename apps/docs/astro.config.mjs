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
			title: 'OpenUJI Speculator',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/openuji/speculator' }],
			plugins: [
				starlightTypedoc({
					entryPoints: [entry('speculator')],
					output: 'api/speculator',
					tsconfig: tsconfig('speculator'),
					typeDoc: {
						name: 'Speculator Core'
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('speculator-lint')],
					output: 'api/speculator-lint',
					tsconfig: tsconfig('speculator-lint'),
					typeDoc: {
						name: 'Speculator Lint'
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('speculator-search')],
					output: 'api/speculator-search',
					tsconfig: tsconfig('speculator-search'),
					typeDoc: {
						name: 'Speculator Search'
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('render-respec')],
					output: 'api/render-respec',
					tsconfig: tsconfig('render-respec'),
					typeDoc: {
						name: 'Render ReSpec'
					}
				}),
				starlightTypedoc({
					entryPoints: [entry('vocab-build')],
					output: 'api/vocab-build',
					tsconfig: tsconfig('vocab-build'),
					typeDoc: {
						name: 'Vocab Build'
					}
				}),
			],
			sidebar: [
				{
					label: 'Guides',
					items: [
						{ label: 'Introduction', slug: 'introduction' },
						{ label: 'Getting Started', slug: 'getting-started' },
					],
				},
				{
					label: 'API Reference',
					items: [
						{ label: 'Speculator Core', autogenerate: { directory: 'api/speculator' } },
						{ label: 'Speculator Lint', autogenerate: { directory: 'api/speculator-lint' } },
						{ label: 'Speculator Search', autogenerate: { directory: 'api/speculator-search' } },
						{ label: 'Render ReSpec', autogenerate: { directory: 'api/render-respec' } },
						{ label: 'Vocab Build', autogenerate: { directory: 'api/vocab-build' } },
					],
				},
			],
		}),
	],
});
