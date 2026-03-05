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
import { speculate, corePlugins, MemoryFileProvider } from '@openuji/speculator';

const SAMPLES_DIR = resolve(fileURLToPath(import.meta.url), '../../samples/webmcp');

let result: MigrationResult;

beforeAll(async () => {
    const content = await readFile(resolve(SAMPLES_DIR, 'index.bs'), 'utf-8');
    result = await migrate(content);
});

describe('webmcp config.json', () => {

    it('has group set to webml', () => {
        expect(result.config.bikeshed!.group).toBe('webml');
    });

    it('has editors', () => {
        expect(result.config.bikeshed!.editor).toBeDefined();
        expect((result.config.bikeshed!.editor as any[]).length).toBeGreaterThan(0);
    });

    it('has localBiblio with MCP entry', () => {
        expect((result.config.bikeshed!.biblio as any)?.['mcp']).toBeDefined();
    });

    it('biblio MCP entry uses url not href', () => {
        const mcp = (result.config.bikeshed!.biblio as any)!['mcp'];
        expect(mcp.url).toBeDefined();
        expect(mcp.href).toBeUndefined();
    });
});

describe('webmcp index.md', () => {
    it('does not contain raw <h2> HTML headings', () => {
        // After transform, HTML headings should be converted to markdown
        expect(result.md).not.toMatch(/<h2\s/);
        expect(result.md).not.toMatch(/<h3\s/);
    });

    it('contains markdown headings converted from HTML headings (level preserved)', () => {
        // <h2> → ##, <h3> → ###, etc. (HTML heading level used as-is)
        expect(result.md).toContain('## Introduction {#intro}');
        expect(result.md).toContain('## Terminology {#terminology}');
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

    it('does not contain <style> blocks (extracted to resources)', () => {
        expect(result.md).not.toMatch(/<style[\s>]/);
    });

    it('does not contain HTML comments (stripped for MDX compatibility)', () => {
        expect(result.md).not.toContain('<!--');
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

describe('webmcp resources', () => {
    it('extracts at least one style resource from the <style> block', () => {
        const styles = result.resources.filter(r => r.type === 'style');
        expect(styles.length).toBeGreaterThan(0);
    });

    it('style resource contains CSS content', () => {
        const style = result.resources.find(r => r.type === 'style');
        expect(style?.content).toContain('.domintro');
    });
});

describe('webmcp speculate() verification', () => {
    it('parses without errors through Speculator pipeline', async () => {
        const configJson = JSON.stringify(result.config, null, 2);
        const fileProvider = new MemoryFileProvider({
            '/spec/index.md': result.md,
            '/spec/config.json': configJson,
        });
        const speculateResult = await speculate({
            entry: '/spec/index.md',
            fileProvider,
            plugins: corePlugins,
        });
        expect(speculateResult.errors ?? []).toEqual([]);
        expect(speculateResult.workspace).toBeDefined();
        expect(speculateResult.workspace!.documents[0].metadata?.title).toBe('WebMCP');
    });
});
