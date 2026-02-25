/**
 * Spec Statement HTML Parser Tests
 */

import { describe, it, expect } from 'vitest';
import { HtmlUnitParser } from '#src/parse/html/index';
import type { SourceUnit } from '#src/preprocess/types';
import type { BlockSpecStatement } from '#src/types/ast.generated';

function createUnit(content: string, file = '/spec/test.html'): SourceUnit {
    return { file, format: 'html', content, startLine: 1 };
}

describe('SpecStatementHtmlParser', () => {
    const parser = new HtmlUnitParser();

    it('parses basic spec-statement', () => {
        const unit = createUnit('<spec-statement>The client MUST send an Accept header.</spec-statement>');
        const blocks = parser.parse(unit);

        expect(blocks).toHaveLength(1);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.type).toBe('specStatement');
        expect(stmt.level).toBe('MUST');
        expect(stmt.tempId).toBe('the-client-must-send-an-accept-header');
        expect(stmt.id).toBeUndefined();
    });

    it('infers MUST NOT correctly', () => {
        const unit = createUnit('<spec-statement>The server MUST NOT disclose the secret.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.level).toBe('MUST NOT');
    });

    it('prefers explicit level attribute', () => {
        const unit = createUnit('<spec-statement level="MAY">The server MUST NOT disclose the secret.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.level).toBe('MAY');
    });

    it('prefers explicit id attribute', () => {
        const unit = createUnit('<spec-statement id="secret-disclosure">The server MUST NOT disclose the secret.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.id).toBe('secret-disclosure');
    });

    it('generates tempId from text when no explicit ID', () => {
        const unit = createUnit('<spec-statement>The server MUST NOT disclose the secret.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.tempId).toBe('the-server-must-not-disclose-the-secret');
        expect(stmt.id).toBeUndefined();
    });

    it('extracts data-id-pattern', () => {
        const unit = createUnit('<spec-statement data-id-pattern="req-{\\d}">The server MUST NOT disclose the secret.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.dataIdPattern).toBe('req-{\\d}');
    });

    it('detects AMBIGUOUS if multiple keywords are present', () => {
        const unit = createUnit('<spec-statement>The server MUST NOT disclose the secret, but MAY log it.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.level).toBe('AMBIGUOUS');
    });

    it('collapses internal whitespace for contentText', () => {
        const unit = createUnit('<spec-statement>  The   client    MUST    send  </spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.contentText).toBe('The client MUST send');
    });

    it('handles nested inline markup', () => {
        const unit = createUnit('<spec-statement>The client <strong>MUST</strong> send an <code>Accept</code> header.</spec-statement>');
        const blocks = parser.parse(unit);
        const stmt = blocks[0] as BlockSpecStatement;
        expect(stmt.contentText).toBe('The client MUST send an Accept header.');
        // Children are now inline nodes (unwrapped from paragraph)
        expect(stmt.children).toHaveLength(5);
        expect(stmt.children[0].type).toBe('text');
        expect(stmt.children[1].type).toBe('strong');
        expect(stmt.children[3].type).toBe('inlineCode');
    });
});
