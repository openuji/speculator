import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { corePlugins, speculate } from '@openuji/speculator';
import { renderAst, renderDocument } from '#src/index';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(testDir, 'fixtures', 'single-spec');
const likec4FixtureDir = path.resolve(testDir, 'fixtures', 'likec4-workspace');
const entry = path.resolve(fixtureDir, 'index.md');
const configPath = path.resolve(fixtureDir, 'config.json');
const customConfigPath = path.resolve(fixtureDir, 'custom-config.json');

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
  );
});

describe('renderDocument', () => {
  it('renders a single document without requiring speculator.workspace.json', async () => {
    const result = await renderDocument({
      entry,
      configPath,
    });

    expect(result.document.id).toBe('example-spec');
    expect(result.workspace.documents).toHaveLength(1);
    expect(result.html).toContain('<!doctype html>');
    expect(result.html).toContain('Example Protocol');
  });

  it('supports explicit configPath outside default sibling resolution', async () => {
    const result = await renderDocument({
      entry,
      configPath: customConfigPath,
    });

    expect(result.document.id).toBe('custom-config-id');
    expect(result.html).toContain('Custom Config Title');
  });

  it('supports configurable metadata row ordering', async () => {
    const result = await renderDocument({
      entry,
      configPath,
      options: {
        metadata: {
          rowOrder: ['authors', 'editors', 'status'],
        },
      },
    });

    const authorsIndex = result.html.indexOf('Authors');
    const editorsIndex = result.html.indexOf('Editors');
    const statusIndex = result.html.indexOf('Status');

    expect(authorsIndex).toBeGreaterThan(-1);
    expect(editorsIndex).toBeGreaterThan(-1);
    expect(statusIndex).toBeGreaterThan(-1);
    expect(authorsIndex).toBeLessThan(editorsIndex);
    expect(editorsIndex).toBeLessThan(statusIndex);
  });

  it('renders links, citations, bibliography, conformance, and TOC content', async () => {
    const result = await renderDocument({
      entry,
      configPath,
      options: {
        includeToc: true,
      },
    });

    expect(result.html).toContain('class="xref"');
    expect(result.html).toContain('data-cite="RFC2119"');
    expect(result.html).toContain('id="references"');
    expect(result.html).toContain('id="bib-RFC2119"');
    expect(result.html).toContain('id="conformance"');
    expect(result.html).toContain('class="toc"');
  });

  it('injects Mermaid and LikeC4 runtime scripts based on document contents', async () => {
    const result = await renderDocument({
      entry,
      configPath,
      options: {
        client: {
          likec4Workspace: likec4FixtureDir,
        },
      },
    });

    expect(result.html).toContain('<spec-mermaid>');
    expect(result.html).toContain('<spec-likec4');
    expect(result.html).toContain('id="spec-page-likec4-dump"');
    expect(result.html).toContain(`import '@openuji/spec-page/components/mermaid';`);
    expect(result.html).toContain(`import '@openuji/spec-page/components/likec4';`);
  });
});

describe('renderAst', () => {
  it('renders an already-built workspace/document', async () => {
    const speculative = await speculate({
      entry,
      configPath,
      plugins: corePlugins,
    });

    if (!speculative.workspace) {
      throw new Error('Expected workspace from speculate()');
    }

    const result = await renderAst({
      workspace: speculative.workspace,
      documentId: 'example-spec',
      options: {
        includeToc: false,
      },
    });

    expect(result.html).toContain('Example Protocol');
    expect(result.html).not.toContain('class="toc"');
  });
});
