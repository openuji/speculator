/**
 * Shorthand Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '#src/parse/markdown/index';
import type { SourceUnit } from '#src/preprocess/types';
import type { BlockParagraph, InlineWorkspaceDfnReference } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.md'): SourceUnit {
    return { file, format: 'markdown', content, startLine: 1 };
}

describe('ShorthandsMarkdownParser', () => {
    const parser = new MarkdownUnitParser();

    describe('references [[REF]]', () => {
        it('parses basic reference as InlineCite', () => {
            const unit = createUnit('See [[RFC2119]].');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children).toHaveLength(3);
            expect(para.children[0]).toMatchObject({ type: 'text', value: 'See ' });
            expect(para.children[1]).toMatchObject({ type: 'cite', key: 'RFC2119' });
            expect(para.children[2]).toMatchObject({ type: 'text', value: '.' });
        });

        it('parses forced normative [[!REF]]', () => {
            const unit = createUnit('[[!HTML]] is required.');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[0]).toMatchObject({ type: 'cite', key: 'HTML', forcedNormative: true });
        });

        it('parses forced informative [[?FOO]]', () => {
            const unit = createUnit('Check [[?FOO]].');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({ type: 'cite', key: 'FOO', forcedInformative: true });
        });

        it('parses expanded reference [[[REF]]]', () => {
            const unit = createUnit('Title: [[[FULLSCREEN]]]');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({ type: 'cite', key: 'FULLSCREEN', expanded: true });
        });
    });

    describe('concepts [=concept=]', () => {
        it('parses basic concept as InlineWorkspaceReference', () => {
            const unit = createUnit('Let [=queue a task=] be...');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({
                type: 'workspaceDfnReference',
                targetTerm: 'queue a task',
            });
            const ref = para.children[1] as InlineWorkspaceDfnReference;
            expect(ref.children[0]).toMatchObject({ type: 'text', value: 'queue a task' });
        });

        it('parses concept with alias [=concept|alias=]', () => {
            const unit = createUnit('Use [=convoluted|simple=] terms.');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({
                type: 'workspaceDfnReference',
                targetTerm: 'convoluted',
            });
            const ref = para.children[1] as InlineWorkspaceDfnReference;
            expect(ref.children[0]).toMatchObject({ type: 'text', value: 'simple' });
        });
    });

    describe('variables |var|', () => {
        it('parses variable as InlineVariable', () => {
            const unit = createUnit('Let |value| be 1.');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({
                type: 'variable',
                value: 'value',
            });
        });
    });

    describe('nested and mixed contents', () => {
        it('handles multiple shorthands in one line', () => {
            const unit = createUnit('In [[HTML]], people [=fire an event=] with |data|.');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            // In (text) [[HTML]] (cite) , people (text) [=fire an event=] (ref) with (text) |data| (variable) . (text)
            expect(para.children).toHaveLength(7);
            expect(para.children[1].type).toBe('cite');
            expect(para.children[3].type).toBe('workspaceDfnReference');
            expect(para.children[5].type).toBe('variable');
        });

        it('parses WebIDL and element shorthands', () => {
            const unit = createUnit('Uses {{Interface}} and [^tag^].');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children).toHaveLength(5);
            expect(para.children[1]).toMatchObject({ type: 'workspaceIdlReference' });
            expect(para.children[3]).toMatchObject({ type: 'workspaceElementReference' });
        });
    });

    describe('sections [§#id]', () => {
        it('parses basic section reference', () => {
            const unit = createUnit('See [§#intro].');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({
                type: 'sectionReference',
                targetId: 'intro',
            });
        });

        it('parses section reference with alias', () => {
            const unit = createUnit('Go to [§#details|the details].');
            const blocks = parser.parse(unit);
            const para = blocks[0] as BlockParagraph;

            expect(para.children[1]).toMatchObject({
                type: 'sectionReference',
                targetId: 'details',
            });
            const ref = para.children[1] as any;
            expect(ref.children[0]).toMatchObject({ type: 'text', value: 'the details' });
        });
    });
});
