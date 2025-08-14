import { Speculator } from '../src/browser';
import type { FileLoader } from '../src/types';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock file system for testing
const mockFiles = {
  'file:///sections/intro.md': `# Introduction

This specification defines the **Unified JavaScript Scrolling Engine** (UJSE).

## Features

- Hardware acceleration
- Custom easing  
- Cross-browser support`,

  'file:///idl/ujse.webidl': `interface SmoothScroller {
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
      fileLoader: mockFileLoader
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
      const sections = Array.from(
        container.querySelectorAll(
          'section[data-include], section[data-format], *[data-include], *[data-format]'
        )
      ) as Element[];
      const result = await renderer.renderDocument({ sections });

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
      const sections = Array.from(
        container.querySelectorAll(
          'section[data-include], section[data-format], *[data-include], *[data-format]'
        )
      ) as Element[];
      const result = await renderer.renderDocument({ sections });

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('renderHTML', () => {
    it('should process HTML string', async () => {
      const html = '<section data-format="markdown">## Test\nHello **world**!</section>';

      const result = await renderer.renderHTML(html);

      expect(result.html).toContain('<h2 id="test">Test</h2>');
      expect(result.html).toContain('<strong>world</strong>');
    });

    it('should handle HTML without special attributes', async () => {
      const html = '<section><p>Hello</p></section>';

      const result = await renderer.renderHTML(html);

      expect(result.html).toContain('<p>Hello</p>');
    });
  });

  describe('configuration options', () => {
    it('should use custom baseUrl', async () => {
      const customRenderer = new Speculator({
        baseUrl: 'https://custom.com',
        fileLoader: async (path: string) => {
          expect(path).toBe('https://custom.com/test.md');
          return '# Custom Test';
        }
      });

      console.log('renderer', renderer);

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
