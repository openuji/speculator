// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightTypedoc from 'starlight-typedoc';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'OpenUJI Speculator',
			social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/openuji/speculator' }],
			plugins: [
				starlightTypedoc({
					entryPoints: ['../../packages/speculator/src/index.ts'],
					output: 'api/speculator',
					tsconfig: '../../packages/speculator/tsconfig.json',
					typeDoc: {
						name: 'Speculator Core'
					}
				}),
				starlightTypedoc({
					entryPoints: ['../../packages/speculator-lint/src/index.ts'],
					output: 'api/speculator-lint',
					tsconfig: '../../packages/speculator-lint/tsconfig.json',
					typeDoc: {
						name: 'Speculator Lint'
					}
				}),
				starlightTypedoc({
					entryPoints: ['../../packages/speculator-search/src/index.ts'],
					output: 'api/speculator-search',
					tsconfig: '../../packages/speculator-search/tsconfig.json',
					typeDoc: {
						name: 'Speculator Search'
					}
				}),
				starlightTypedoc({
					entryPoints: ['../../packages/render-respec/src/index.ts'],
					output: 'api/render-respec',
					tsconfig: '../../packages/render-respec/tsconfig.json',
					typeDoc: {
						name: 'Render ReSpec'
					}
				}),
				starlightTypedoc({
					entryPoints: ['../../packages/vocab-build/src/index.ts'],
					output: 'api/vocab-build',
					tsconfig: '../../packages/vocab-build/tsconfig.json',
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
