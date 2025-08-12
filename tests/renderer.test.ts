import { Speculator, SpeculatorError } from '../src/index';
import type { FileLoader } from '../src/types';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock file system for testing
const mockFiles = {
  '/sections/intro.md': `# Introduction

This specification defines the **Unified JavaScript Scrolling Engine** (UJSE).

## Features

- Hardware acceleration
- Custom easing  
- Cross-browser support`,

  '/idl/ujse.webidl': `interface SmoothScroller {
  void scrollTo(double x, double y);
  readonly attribute boolean isScrolling;
};`
};

const mockFileLoader: FileLoader = async (path: string) => {
  if (mockFiles[path as keyof typeof mockFiles]) {
    return mockFiles[path as keyof typeof mockFiles];
  }
  throw new Error(`File not found: ${path}`);
};

describe('Speculator', () => {
  let renderer: Speculator;

  beforeEach(() => {
    renderer = new Speculator({
      baseUrl: '/',
      fileLoader: mockFileLoader
    });
  });

  describe('processElement', () => {
    it('should process inline markdown', async () => {
      document.body.innerHTML = '<section id="test" data-format="markdown">## Hello\nThis is **bold** text.</section>';
      const element = document.querySelector('#test')!;

      const result = await renderer.processElement(element);

      expect(result.element.innerHTML).toContain('<h2 id="hello">Hello</h2>');
      expect(result.element.innerHTML).toContain('<strong>bold</strong>');
      expect(result.element.hasAttribute('data-format')).toBe(false);
      expect(result.stats.markdownBlocks).toBe(1);
    });

    it('should include external markdown files', async () => {
      document.body.innerHTML = '<section id="test" data-include="/sections/intro.md" data-include-format="markdown"></section>';
      const element = document.querySelector('#test')!;

      const result = await renderer.processElement(element);

      expect(result.element.innerHTML).toContain('<h2 id="introduction">Introduction</h2>');
      expect(result.element.innerHTML).toContain('<strong>Unified JavaScript Scrolling Engine</strong>');
      expect(result.element.hasAttribute('data-include')).toBe(false);
      expect(result.stats.filesIncluded).toBe(1);
    });

    it('should include text files without processing', async () => {
      document.body.innerHTML = '<pre data-include="/idl/ujse.webidl" data-include-format="text"></pre>';
      const element = document.querySelector('pre')!;

      const result = await renderer.processElement(element);

      expect(result.element.innerHTML).toContain('interface SmoothScroller');
      expect(result.element.innerHTML).toContain('void scrollTo');
      expect(result.stats.filesIncluded).toBe(1);
      expect(result.stats.markdownBlocks).toBe(0);
    });

    it('should handle file loading errors gracefully', async () => {
      document.body.innerHTML = '<section data-include="/nonexistent.md"></section>';
      const element = document.querySelector('section')!;

      await expect(renderer.processElement(element))
        .rejects.toThrow(SpeculatorError);
    });

    it('should collect warnings for empty data-include', async () => {
      document.body.innerHTML = '<section data-include=""></section>';
      const element = document.querySelector('section')!;

      const result = await renderer.processElement(element);

      expect(result.warnings).toContain('data-include attribute is empty');
    });
  });

  describe('renderDocument', () => {
    it('should process multiple sections', async () => {
      document.body.innerHTML = `
        <div id="container">
          <section data-format="markdown">## Section 1</section>
          <section data-include="/sections/intro.md" data-include-format="markdown"></section>
          <pre data-include="/idl/ujse.webidl" data-include-format="text"></pre>
        </div>
      `;

      const container = document.querySelector('#container')!;
      const result = await renderer.renderDocument(container);

      expect(result.stats.elementsProcessed).toBe(3);
      expect(result.stats.filesIncluded).toBe(2);
      expect(result.stats.markdownBlocks).toBe(2);
      expect(result.stats.processingTime).toBeGreaterThan(0);
    });

    it('should aggregate warnings from multiple elements', async () => {
      document.body.innerHTML = `
        <div id="container">
          <section data-include=""></section>
          <section data-include="/nonexistent.md"></section>
        </div>
      `;

      const container = document.querySelector('#container')!;
      const result = await renderer.renderDocument(container);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('renderHTML', () => {
    it('should process HTML string', async () => {
      const html = '<section data-format="markdown">## Test\nHello **world**!</section>';

      const result = await renderer.renderHTML(html);

      expect(result).toContain('<h2 id="test">Test</h2>');
      expect(result).toContain('<strong>world</strong>');
    });
  });

  describe('configuration options', () => {
    it('should use custom baseUrl', async () => {
      const customRenderer = new Speculator({
        baseUrl: '/custom',
        fileLoader: async (path: string) => {
          expect(path).toBe('/custom/test.md');
          return '# Custom Test';
        }
      });

      document.body.innerHTML = '<section data-include="test.md" data-include-format="markdown"></section>';
      const element = document.querySelector('section')!;

      const result = await customRenderer.processElement(element);
      expect(result.element.innerHTML).toContain('Custom Test');
    });

    it('should use custom markdown options', async () => {
      const customRenderer = new Speculator({
        fileLoader: mockFileLoader,
        markdownOptions: {
          gfm: false,
          breaks: false
        }
      });

      document.body.innerHTML = '<section data-format="markdown">## Test\nLine break</section>';
      const element = document.querySelector('section')!;

      const result = await customRenderer.processElement(element);
      // Should not create line breaks when breaks: false
      expect(result.element.innerHTML).not.toContain('<br>');
    });
  });
});
