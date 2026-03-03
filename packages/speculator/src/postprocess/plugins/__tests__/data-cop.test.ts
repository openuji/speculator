import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import { HtmlUnitParser } from '#src/parse/html/index';
import { assembleDocument } from '#src/parse/assembler';
import { SourceMapper } from '#src/parse/source-mapper';
import { statementIndexPlugin } from '../statement-index';
import { statementsJsonLdComputePlugin } from '../statementsJsonLd-compute';

function mdParse(parser: MarkdownUnitParser, content: string, file = 'test.md') {
    const mapper = new SourceMapper(content, {
        fragments: [{ startOffset: 0, endOffset: content.length, file, format: 'markdown', originalStartLine: 1 }]
    });
    return parser.parse(content, mapper);
}

function htmlParse(parser: HtmlUnitParser, content: string, file = 'test.html') {
    const mapper = new SourceMapper(content, {
        fragments: [{ startOffset: 0, endOffset: content.length, file, format: 'html', originalStartLine: 1 }]
    });
    return parser.parse(content, mapper);
}

describe('data-cop resolution', () => {
    const mdParser = new MarkdownUnitParser();
    const htmlParser = new HtmlUnitParser();

    it('resolves data-cop from markdown headings', async () => {
        const content = `
## Client {data-cop-concept="client"}


<spec-statement>The client MUST ...</spec-statement>

## Identity Provider {#idp data-cop-concept="#IDP"}

<spec-statement>The IDP MUST ...</spec-statement>

## Standard Role {data-cop-concept="spec:Standard"}

<spec-statement>The Role MUST ...</spec-statement>
`;
        const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = mdParse(mdParser, content);
        const document = assembleDocument(blocks, config, 'test.md');

        await statementIndexPlugin.index!({ 
            document, 
            level: 0,
            config
        });

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('https://example.org/spec/1.0.0#client');
        expect(statements[1].subject).toBe('https://example.org/spec/1.0.0#IDP');
        expect(statements[2].subject).toBe('https://example.org/spec/1.0.0#spec:Standard');
    });

    it('resolves data-cop from HTML sections', async () => {
        const content = `
<section data-cop-concept="server">
    <h2>Server</h2>
    <spec-statement>The server MUST ...</spec-statement>
</section>

<section data-cop-concept="ua">
    <h2>User Agent</h2>
    <spec-statement data-cop-concept="client">The UA acting as client MUST ...</spec-statement>
    <spec-statement>The UA MUST ...</spec-statement>
</section>
`;
const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = htmlParse(htmlParser, content);
        const document = assembleDocument(blocks, config, 'test.html');

        await statementIndexPlugin.index!({ 
            document, 
            level: 0,
            config
        });

        const statements = document.indexes!.statements!;
        expect(statements).toHaveLength(3);
        
        expect(statements[0].subject).toBe('https://example.org/spec/1.0.0#server');
        expect(statements[1].subject).toBe('https://example.org/spec/1.0.0#client'); // Overridden by statement
        expect(statements[2].subject).toBe('https://example.org/spec/1.0.0#ua'); // Bare token fallback
    });

    it('emits correct JSON-LD with spec:classesOfProducts and skos:ConceptScheme', async () => {
        const content = `
## Client {data-cop-concept="client"}

<spec-statement>The client MUST ...</spec-statement>

## Server {data-cop-concept="server"}

<spec-statement>The server MUST ...</spec-statement>
`;
const config = { id: 'test', title: 'Test', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = mdParse(mdParser, content);
        const document = assembleDocument(blocks, config, 'test.md');

        await statementIndexPlugin.index!({ document, config, level: 0 });
        
        await statementsJsonLdComputePlugin.compute!({ 
            document, 
            config,
            level: 0
        });

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        const graph = jsonLd['@graph'] as Record<string, unknown>[];

        // 1. Check Specification node with embedded ConceptScheme
        const specNode = graph.find(n => n.type === 'spec:Specification');
        expect(specNode).toBeDefined();
        
        const scheme = specNode!['spec:classesOfProducts'];
        expect(scheme).toBeDefined();
        expect(scheme.id).toBe('https://example.org/spec/1.0.0#classes-of-products');
        expect(scheme.type).toBe('skos:ConceptScheme');

        // 2. Check embedded top concepts
        const topConcepts = scheme['skos:hasTopConcept'];
        expect(topConcepts).toBeDefined();
        expect(topConcepts).toHaveLength(2);
        expect(topConcepts).toContainEqual({ id: 'https://example.org/spec/1.0.0#client' });
        expect(topConcepts).toContainEqual({ id: 'https://example.org/spec/1.0.0#server' });

        // 3. Check Concept nodes in graph
        const clientConcept = graph.find(n => n.id === 'https://example.org/spec/1.0.0#client');
        expect(clientConcept).toBeDefined();
        expect(clientConcept!.type).toBe('skos:Concept');
        expect(clientConcept!['skos:inScheme']).toEqual({ id: 'https://example.org/spec/1.0.0#classes-of-products' });
        expect(clientConcept!['skos:topConceptOf']).toEqual({ id: 'https://example.org/spec/1.0.0#classes-of-products' });
        expect(clientConcept!['skos:prefLabel']).toBe('Client');

        const serverConcept = graph.find(n => n.id === 'https://example.org/spec/1.0.0#server');
        expect(serverConcept).toBeDefined();
        expect(serverConcept!.type).toBe('skos:Concept');
        expect(serverConcept!['skos:topConceptOf']).toEqual({ id: 'https://example.org/spec/1.0.0#classes-of-products' });
    });

    it('emits full JSON-LD matching documentation example (section inheritance + override)', async () => {
        // This test matches the exact example from features/spec-statements.md
        const content = `
<section data-cop-concept="server">
    <h2>Server Requirements</h2>
    <spec-statement>The server MUST validate tokens.</spec-statement>
    <spec-statement data-cop-concept="client">The client MAY cache tokens.</spec-statement>
</section>
`;
const config = { id: 'test', title: 'My Specification', specIri: 'https://example.org/spec/1.0.0' };
        const blocks = htmlParse(htmlParser, content);
        const document = assembleDocument(blocks, config, 'test.html');

        await statementIndexPlugin.index!({ document, config, level: 0 });
        
        await statementsJsonLdComputePlugin.compute!({ 
            document, 
            config,
            level: 0
        });

        const jsonLd = document.computed!.statementsJsonLd as Record<string, unknown>;
        const graph = jsonLd['@graph'] as Record<string, unknown>[];
        
        // 1. Verify Specification has refs to requirements and embedded scheme
        const specNode = graph.find(n => n.type === 'spec:Specification');
        expect(specNode).toBeDefined();
        const reqRefs = specNode!['spec:requirement'] as { id: string }[];
        expect(reqRefs).toHaveLength(2);

        // 2. Verify Embedded ConceptScheme
        const scheme = specNode!['spec:classesOfProducts'];
        expect(scheme).toBeDefined();
        expect(scheme.type).toBe('skos:ConceptScheme');
        
        const topConcepts = scheme['skos:hasTopConcept'] as { id: string }[];
        expect(topConcepts).toContainEqual({ id: 'https://example.org/spec/1.0.0#server' });
        expect(topConcepts).toContainEqual({ id: 'https://example.org/spec/1.0.0#client' });

        // 3. Requirements in graph
        const requirements = graph.filter(n => n.type === 'spec:Requirement');
        expect(requirements).toHaveLength(2);

        // First statement: inherits server, level MUST -> Requirement
        const serverStmt = requirements.find(s => 
            (s['spec:statement'] as string).includes('server MUST validate tokens')
        );
        expect(serverStmt).toBeDefined();
        expect(serverStmt!['spec:requirementLevel']).toEqual({ id: 'spec:MUST' });
        expect(serverStmt!['spec:requirementSubject']).toEqual({ id: 'https://example.org/spec/1.0.0#server' });

        // Second statement: overrides to client, level MAY -> Requirement
        const clientStmt = requirements.find(s => 
            (s['spec:statement'] as string).includes('client MAY cache tokens')
        );
        expect(clientStmt).toBeDefined();
        expect(clientStmt!['type']).toBe('spec:Requirement');
        expect(clientStmt!['spec:requirementLevel']).toEqual({ id: 'spec:MAY' });
        expect(clientStmt!['spec:requirementSubject']).toEqual({ id: 'https://example.org/spec/1.0.0#client' });
    });
});
