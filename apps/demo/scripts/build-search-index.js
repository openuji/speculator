import { speculate, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { contentIdPlugin, searchIndexPlugin, buildSearchIndex, loadSearchConfig, applyRoutingConfig } from '@openuji/speculator-search';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function buildSearchIndexFile() {
    console.log('🔍 Building search index...');

    const specDir = path.join(rootDir, 'spec');
    const entryFile = path.join(specDir, 'index.md');
    const searchConfigFile = path.join(rootDir, 'config.search.json');
    const outputFile = path.join(rootDir, 'public', 'search-index.json');

    // Load search configuration
    const config = await loadSearchConfig(searchConfigFile);

    // Run Speculator pipeline with search plugins
    const result = await speculate({
        entry: entryFile,
        plugins: [
            ...corePlugins,
            contentIdPlugin,
            searchIndexPlugin({
                configPath: searchConfigFile
            })
        ],
        fileProvider: new NodeFileProvider(),
    });

    // Build search index (raw mode for client-side search)
    const searchIndex = buildSearchIndex(result, {
        mode: 'raw',
        includeSourcePos: false  // Reduce file size for production
    });

    // Apply routing configuration
    applyRoutingConfig(searchIndex, config, rootDir);

    // Ensure output directory exists
    await fs.mkdir(path.dirname(outputFile), { recursive: true });

    // Write to public directory (served as static file)
    await fs.writeFile(
        outputFile,
        JSON.stringify(searchIndex, null, 2),
        'utf-8'
    );

    console.log(`✅ Search index built: ${outputFile}`);
    console.log(`   Documents: ${searchIndex.documents.length}`);
    console.log(`   Total entries: ${searchIndex.documents.reduce((sum, doc) => sum + doc.entries.length, 0)}`);

    const stats = await fs.stat(outputFile);
    console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);
}

// Run build
buildSearchIndexFile().catch(err => {
    console.error('❌ Search index build failed:', err);
    process.exit(1);
});
