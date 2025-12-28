import { SpeculatorPipeline, corePlugins, NodeFileProvider } from '@openuji/speculator';
import { buildSearchIndex } from '@openuji/speculator-search';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

/**
 * Route mapping for documents
 * Maps relative document paths to their rendered routes
 */
const ROUTE_MAP = {
    'spec/index.md': '/',
    'spec/workspace/pkg-a/index.html': '/workspace/pkg-a',
    'spec/workspace/pkg-b/index.html': '/workspace/pkg-b'
};

async function buildSearchIndexFile() {
    console.log('🔍 Building search index...');

    const specDir = path.join(rootDir, 'spec');
    const outputFile = path.join(rootDir, 'public', 'search-index.json');

    // Setup pipeline with core plugins only (no search plugins needed)
    const pipeline = new SpeculatorPipeline(corePlugins);

    // Run pipeline on all documents
    const result = await pipeline.runWorkspace({
        entries: [
            { entry: path.join(specDir, 'index.md') },
            { entry: path.join(specDir, 'workspace/pkg-a/index.html') },
            { entry: path.join(specDir, 'workspace/pkg-b/index.html') }
        ],
        fileProvider: new NodeFileProvider(),
    });

    if (!result.workspace) {
        throw new Error('Pipeline did not produce a workspace');
    }

    // Build search index using standalone builder
    const { data: searchIndex } = await buildSearchIndex(result.workspace, {
        includeSourcePos: false  // Reduce file size for production
    });

    // Apply route mapping (app-specific logic)
    for (const doc of searchIndex.documents) {
        const relativePath = getRelativePath(doc.documentId, rootDir);
        doc.route = ROUTE_MAP[relativePath] || '/';
    }

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

/**
 * Get relative path from absolute documentId
 */
function getRelativePath(absolutePath, baseDir) {
    const normalizedPath = absolutePath.split(/[/\\]/).join('/');
    const normalizedBase = baseDir.split(/[/\\]/).join('/');

    if (normalizedPath.startsWith(normalizedBase)) {
        let relative = normalizedPath.substring(normalizedBase.length);
        if (relative.startsWith('/')) {
            relative = relative.substring(1);
        }
        return relative;
    }
    return absolutePath;
}

// Run build
buildSearchIndexFile().catch(err => {
    console.error('❌ Search index build failed:', err);
    process.exit(1);
});
