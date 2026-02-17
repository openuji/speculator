import { describe, it, expect } from 'vitest';
import { speculate, corePlugins, type Document } from '#src/index';
import { MemoryFileProvider } from '#src/file-provider/memory';

describe('Table Statement Distribution Reproduction', () => {
    it('should skip header row and include all data rows even with optional keyword', async () => {
        const content = `
## Identity Provider {#idp data-cop-concept="#IDP"}

<spec-statement>It **MUST** satisfy the following schema:

| Field        | Requirement | Description                                  |
| ------------ | ----------- | -------------------------------------------- |
| \`type\`       | \`required\`  | The object class (e.g., \`Journey\`, \`State\`). |
| \`id\`         | \`required\`  | Unique URI/URN identifier.                   |
| \`meta\`       | \`optional\`  | Metadata object (versioning, timestamps).    |
| \`extensions\` | \`optional\`  | Use case and/or Vendor-specific data.        |

 </spec-statement>
`;

        const fileProvider = new MemoryFileProvider({
            'index.md': content,
            'config.json': JSON.stringify({
                id: 'pkg-a',
                specIri: 'http://example.org/spec',
                dataCopConcept: '#IDP'
            })
        });

        const result = await speculate({
            entry: 'index.md',
            plugins: corePlugins,
            fileProvider
        });

        const document = result.workspace?.documents[0] as Document;
        const statements = document?.indexes?.statements || [];

        // We expect exactly 4 statements (one for each data row). 
        // The header row "Field Requirement Description" should definitely NOT be a statement.
        
        // Issue 1: Header row should be skipped
        const headerStatement = statements.find(s => s.contentText.includes('Field Requirement Description'));
        expect(headerStatement).toBeUndefined();

        // Issue 2: meta and extensions should be present
        const metaStatement = statements.find(s => s.contentText.includes('meta optional'));
        const extensionsStatement = statements.find(s => s.contentText.includes('extensions optional'));
        
        expect(metaStatement).toBeDefined();
        expect(extensionsStatement).toBeDefined();

        // Check JSON-LD as well
        const jsonLd = document?.computed?.statementsJsonLd as { '@graph': Record<string, unknown>[] };
        const jsonLdRequirements = jsonLd['@graph'].filter(n => n.type === 'spec:Requirement');
        
        // Header row shouldn't be in JSON-LD either
        const headerJsonLd = jsonLdRequirements.find(n => (n['spec:statement'] as string)?.includes('Field Requirement Description'));
        expect(headerJsonLd).toBeUndefined();

        // meta and extensions should be in JSON-LD
        const metaJsonLd = jsonLdRequirements.find(n => (n['spec:statement'] as string)?.includes('meta optional'));
        const extensionsJsonLd = jsonLdRequirements.find(n => (n['spec:statement'] as string)?.includes('extensions optional'));
        
        expect(metaJsonLd).toBeDefined();
        expect(extensionsJsonLd).toBeDefined();
    });
});
