/**
 * End-to-end test: samples/webmcp/index.bs
 *
 * Validates that the WebMCP Bikeshed spec (HTML-centric style) migrates
 * correctly to Speculator index.md + config.json.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from '../src/migrate.js';
import type { MigrationResult } from '../src/migrate.js';

const SAMPLES_DIR = resolve(fileURLToPath(import.meta.url), '../../../../samples/webmcp');

let result: MigrationResult;

beforeAll(async () => {
    const content = await readFile(resolve(SAMPLES_DIR, 'index.bs'), 'utf-8');
    result = await migrate(content);
});

describe('webmcp config.json', () => {
    it('has correct id from shortname', () => {
        expect(result.config.id).toBe('webmcp');
    });

    it('has correct title', () => {
        expect(result.config.title).toBe('WebMCP');
        expect(result.config.respec.title).toBe('WebMCP');
    });

    it('has group set to webml', () => {
        expect(result.config.respec.group).toBe('webml');
    });

    it('has editors', () => {
        expect(result.config.respec.editors).toBeDefined();
        expect(result.config.respec.editors!.length).toBeGreaterThan(0);
    });

    it('has localBiblio with MCP entry', () => {
        expect(result.config.respec.localBiblio?.['mcp']).toBeDefined();
    });

    it('biblio MCP entry uses url not href', () => {
        const mcp = result.config.respec.localBiblio!['mcp'];
        expect(mcp.url).toBeDefined();
        expect((mcp as Record<string, unknown>)['href']).toBeUndefined();
    });
});

describe('webmcp index.md', () => {
    it('does not contain raw <h2> HTML headings', () => {
        // After transform, HTML headings should be converted to markdown
        expect(result.md).not.toMatch(/<h2\s/);
        expect(result.md).not.toMatch(/<h3\s/);
    });

    it('contains markdown headings converted from HTML headings', () => {
        expect(result.md).toContain('## Introduction ##');
    });

    it('contains webidl code fences from <xmp class="idl">', () => {
        expect(result.md).toContain('```webidl');
    });

    it('webidl code block contains IDL content', () => {
        expect(result.md).toContain('ModelContext');
    });

    it('does not contain <xmp> elements', () => {
        expect(result.md).not.toContain('<xmp');
    });

    it('does not contain <pre class="metadata">', () => {
        expect(result.md).not.toMatch(/<pre\s+class=['"]metadata/);
    });

    it('does not contain <pre class="biblio">', () => {
        expect(result.md).not.toMatch(/<pre\s+class=['"]biblio/);
    });

    it('preserves <dfn> elements as HTML passthrough', () => {
        expect(result.md).toContain('<dfn>');
    });

    it('converts <div algorithm> to section', () => {
        expect(result.md).toContain('<section');
        expect(result.md).toContain('data-algorithm');
        expect(result.md).not.toContain('<div algorithm');
    });
});
