/**
 * End-to-end test: samples/oidc/index.bs
 *
 * Validates that the Solid-OIDC Bikeshed spec migrates correctly to
 * Speculator index.md + config.json.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, type MigrationResult } from '../src/migrate.js';
import { speculate, corePlugins, MemoryFileProvider } from '@openuji/speculator';

const SAMPLES_DIR = resolve(fileURLToPath(import.meta.url), '../../samples/oidc');

let result: MigrationResult;

beforeAll(async () => {
    const content = await readFile(resolve(SAMPLES_DIR, 'index.bs'), 'utf-8');
    result = await migrate(content);
});

describe('oidc config.json', () => {
    it('has correct id from shortname', () => {
        expect(result.config.id).toBe('solid-oidc');
    });

    it('has correct title', () => {
        expect(result.config.title).toBe('Solid-OIDC');
        expect(result.config.respec.title).toBe('Solid-OIDC');
    });

    it('has correct shortName', () => {
        expect(result.config.respec.shortName).toBe('solid-oidc');
    });

    it('has correct specStatus', () => {
        expect(result.config.respec.specStatus).toBe('CG-DRAFT');
    });

    it('has thisVersion from ED field', () => {
        expect(result.config.respec.thisVersion).toBe('https://solid.github.io/solid-oidc/');
    });

    it('has latestVersion from TR field', () => {
        expect(result.config.respec.latestVersion).toBe('https://solidproject.org/TR/oidc');
    });

    it('has correct maxTocLevel', () => {
        expect(result.config.respec.maxTocLevel).toBe(2);
    });

    it('has editors array with correct count', () => {
        expect(result.config.respec.editors).toBeDefined();
        expect(result.config.respec.editors!.length).toBe(3);
    });

    it('first editor has name, url, company', () => {
        const first = result.config.respec.editors![0];
        expect(first.name).toBe('Aaron Coburn');
        expect(first.url).toBeDefined();
        expect(first.company).toBe('Inrupt');
    });

    it('has localBiblio with DPOP entry', () => {
        expect(result.config.respec.localBiblio).toBeDefined();
        expect(result.config.respec.localBiblio!['DPOP']).toBeDefined();
    });

    it('biblio DPOP entry uses url not href', () => {
        const dpop = result.config.respec.localBiblio!['DPOP'];
        expect(dpop.url).toBeDefined();
        expect((dpop as Record<string, unknown>)['href']).toBeUndefined();
    });

    it('has former editors in custom', () => {
        expect(result.config.custom?.formerEditors).toBeDefined();
        expect(Array.isArray(result.config.custom!.formerEditors)).toBe(true);
    });

    it('has abstract', () => {
        expect(result.config.respec.abstract).toBeDefined();
        expect(result.config.respec.abstract!.length).toBeGreaterThan(20);
    });
});

describe('oidc index.md', () => {
    it('does not contain <pre class="metadata">', () => {
        expect(result.md).not.toMatch(/<pre\s+class=['"]metadata/);
    });

    it('does not contain <pre class="biblio">', () => {
        expect(result.md).not.toMatch(/<pre\s+class=['"]biblio/);
    });

    it('contains turtle code fence (from <pre highlight="turtle">)', () => {
        expect(result.md).toContain('```turtle');
    });

    it('contains http code fence (from <pre highlight="http">)', () => {
        expect(result.md).toContain('```http');
    });

    it('strips Bikeshed closing # and demotes ATX headings by one level', () => {
        expect(result.md).toContain('## Introduction {#intro}');
        expect(result.md).not.toContain('# Introduction #');
        // Use line-anchored regex: '## Introduction {#intro}' contains '# Introduction {#intro}' as substring
        expect(result.md).not.toMatch(/^# Introduction/m);
    });

    it('preserves [[!RFC6749]] citation syntax', () => {
        expect(result.md).toContain('[[!RFC6749]]');
    });

    it('preserves Issue(N): markers', () => {
        expect(result.md).toContain('Issue(');
    });

    it('preserves HTML passthrough elements', () => {
        expect(result.md).toContain('<dl>');
        expect(result.md).toContain('<figure');
    });

    it('preserves <figure class="example"> wrapper with code fence inside', () => {
        expect(result.md).toContain('<figure class="example">');
        // Code fence should be inside the wrapper, not hoisted out
        expect(result.md).toMatch(/<figure class="example">[\s\S]*?```[\s\S]*?```[\s\S]*?<\/figure>/);
    });

    it('preserves <div class="example"> wrapper with code fence inside', () => {
        expect(result.md).toContain('<div class="example">');
        expect(result.md).toMatch(/<div class="example">[\s\S]*?```[\s\S]*?```[\s\S]*?<\/div>/);
    });
});

describe('oidc speculate() verification', () => {
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
        expect(speculateResult.workspace!.documents[0].metadata?.title).toBe('Solid-OIDC');
    });
});
