/**
 * Tests for IdlHtmlParser
 */

import { describe, it, expect } from 'vitest';
import { HtmlUnitParser } from '../parser.js';
import { IdlHtmlParser } from '../IdlHtmlParser.js';
import { CodeHtmlParser } from '../CodeHtmlParser.js';
import { defaultRegistry } from '#src/parse/registry';
import type { BlockIdl, InlineDefinition, InlineWorkspaceIdlReference, InlineText } from '#src/types/ast.generated';

// Register the parser for testing
defaultRegistry.registerHtmlParser(IdlHtmlParser);
defaultRegistry.registerHtmlParser(CodeHtmlParser);

describe('IdlHtmlParser', () => {
    const parser = new HtmlUnitParser(defaultRegistry);

    it('ignores non-idl pre blocks', () => {
        const source = {
            file: 'test.html',
            format: 'html' as const,
            content: '<pre>some code</pre>',
            startLine: 1,
        };

        const blocks = parser.parse(source);
        
        // CodeHtmlParser returns [codeBlock]
        // IdlHtmlParser delegates to CodeHtmlParser
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe('codeBlock');
    });

    it('parses interface definition', () => {
        const idl = `
<pre class="idl">
interface Document {
  readonly attribute boolean hidden;
  void close();
};
</pre>
`;
        const unit = {
            file: 'test.html',
            format: 'html' as const,
            content: idl,
            startLine: 1,
        } as const;
        
        const blocks = parser.parse(unit);
        
        // Expect: BlockIdl
        expect(blocks).toHaveLength(1);
        const block = blocks[0] as BlockIdl;
        
        expect(block.type).toBe('idl');
        expect(block.value).toContain('interface Document');

        const children = block.children;
        // Verify key tokens
        
        // interface keyword
        expect(children.some((c): c is InlineText => c.type === 'text' && c.value === 'interface')).toBe(true);
        
        // Document definition
        const docDef = children.find((c): c is InlineDefinition => c.type === 'definition' && c.term === 'Document');
        expect(docDef).toBeDefined();
        if (docDef) expect(docDef.dfnType).toBe('interface');
        
        // close method definition
        const closeDef = children.find((c): c is InlineDefinition => c.type === 'definition' && c.term === 'Document/close');
        expect(closeDef).toBeDefined();
        if (closeDef) expect(closeDef.dfnType).toBe('method');
    });

    it('parses dictionary definition', () => {
        const idl = `
<pre class="idl">
dictionary EventInit {
  boolean bubbles = false;
  boolean cancelable = false;
};
</pre>
`;
        const source = {
            file: 'test.html',
            format: 'html' as const,
            content: idl,
            startLine: 1,
        };

        const blocks = parser.parse(source);
        const block = blocks[0] as BlockIdl;
        
        expect(block.type).toBe('idl');
        const defs = block.children;

        const dictDef = defs.find((d): d is InlineDefinition => d.type === 'definition' && d.term === 'EventInit');
        expect(dictDef).toBeDefined();
        if (dictDef) expect(dictDef.dfnType).toBe('dictionary');

        // Check for Member "EventInit/bubbles"
        // Note: Our naive tokenizer puts members as definitions
        const bubblesDef = defs.find((d): d is InlineDefinition => d.type === 'definition' && d.term === 'EventInit/bubbles');
        expect(bubblesDef).toBeDefined();
    });

    it('parses nullable types correctly', () => {
        const idl = `
<pre class="idl">
interface Element {
  DOMString? getAttribute(DOMString qualifiedName);
};
</pre>
`;
        const unit = {
            file: 'test.html',
            format: 'html' as const,
            content: idl,
            startLine: 1,
        } as const;
        
        const blocks = parser.parse(unit);
        const block = blocks[0] as BlockIdl;
        const children = block.children;

        // "Element" interface
        const elDef = children.find((c): c is InlineDefinition => c.type === 'definition' && c.term === 'Element');
        expect(elDef).toBeDefined();

        // "DOMString" reference
        const dsRef = children.find((c): c is InlineWorkspaceIdlReference => c.type === 'workspaceIdlReference' && c.targetTerm === 'DOMString');
        expect(dsRef).toBeDefined();

        // "?" text
        expect(children.some((c): c is InlineText => c.type === 'text' && c.value === '?')).toBe(true);

        // "getAttribute" method definition
        // Before fix: getAttribute was text because DOMString? was text -> expectingMemberName=false
        // After fix: DOMString is ref -> expectingMemberName=true -> getAttribute is definition
        const methodDef = children.find((c): c is InlineDefinition => c.type === 'definition' && c.term === 'Element/getAttribute');
        expect(methodDef).toBeDefined();
        if (methodDef) expect(methodDef.dfnType).toBe('method');
    });
});
