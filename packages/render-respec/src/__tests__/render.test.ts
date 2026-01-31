import { describe, it, expect } from 'vitest';
import { generateHTML } from '../render/html';
import type { Document, Workspace, BlockSpecStatement, InlineText } from '@openuji/speculator';

describe('render-respec HTML generation', () => {
    it('renders spec-statement with correct classes', async () => {
        const stmtNode: BlockSpecStatement = {
            type: 'specStatement',
            id: 'stmt-1',
            htmlId: 'stmt-stmt-1',
            level: 'MUST NOT',
            normative: true,
            contentText: 'the server must not disclose secrets.',
            children: [{ type: 'text', value: 'The server MUST NOT disclose secrets.' } as InlineText]
        };

        const document: Document = {
            type: 'document',
            id: 'test-doc',
            metadata: { title: 'Test Spec' },
            children: [stmtNode],
            computed: {
                statementsJsonLd: {
                    '@context': {
                        dct: 'http://purl.org/dc/terms/',
                        spec: 'https://speculator.openuji.org/vocab#',
                        id: '@id',
                        type: '@type'
                    },
                    id: 'https://example.org/spec/1.0.0',
                    type: 'spec:Specification',
                    'dct:title': 'Test Spec',
                    'spec:statement': [
                        {
                            id: 'https://example.org/spec/1.0.0#stmt-1',
                            type: 'spec:Requirement',
                            'spec:level': 'MUST NOT',
                            'spec:statement': 'the server must not disclose secrets.'
                        }
                    ]
                }
            },
            indexes: {
                statements: [
                    {
                        id: 'stmt-1',
                        level: 'MUST NOT',
                        contentText: 'the server must not disclose secrets.',
                        sourcePos: { file: 'test.md', line: 1, column: 1 }
                    }
                ]
            }
        };

        const workspace: Workspace = {
            type: 'workspace',
            documents: [document],
            globalIndex: {
                definitions: [],
                bibliography: [],
                statements: document.indexes!.statements!
            }
        };

        const html = await generateHTML(workspace, {
            specStatus: 'ED',
            thisVersion: 'https://example.org/spec/1.0.0',
            maxTocLevel: 3
        }, {
            diagnostics: [],
            hasErrors: false,
            totalTime: 0,
            ruleResults: []
        });

        // Check HTML classes
        expect(html).toContain('class="spec-statement normative must-not"');
        expect(html).toContain('id="stmt-stmt-1"');
        
        // Check JSON-LD
        expect(html).toContain('application/ld+json');
        expect(html).toContain('"type": "spec:Requirement"');
        expect(html).toContain('"spec:level": "MUST NOT"');
        expect(html).toContain('"spec:statement": "the server must not disclose secrets."');
        expect(html).toContain('"id": "https://example.org/spec/1.0.0#stmt-1"');
    });
});
