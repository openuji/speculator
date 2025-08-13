import { FormatProcessor } from '../src/index';
import type { ProcessingStats } from '../src/types';
import { describe, it, expect } from '@jest/globals';

describe('FormatProcessor', () => {
  const createStats = (): ProcessingStats => ({
    elementsProcessed: 0,
    filesIncluded: 0,
    markdownBlocks: 0,
    processingTime: 0,
  });

  it('processes inline markdown', () => {
    const processor = new FormatProcessor();
    const element = document.createElement('section');
    element.setAttribute('data-format', 'markdown');
    element.innerHTML = '## Hello\nThis is **bold** text.';

    const stats = createStats();
    const warnings: string[] = [];

    processor.process(element, stats, warnings);

    expect(element.innerHTML).toContain('<h2 id="hello">Hello</h2>');
    expect(element.innerHTML).toContain('<strong>bold</strong>');
    expect(element.hasAttribute('data-format')).toBe(false);
    expect(stats.markdownBlocks).toBe(1);
    expect(warnings).toHaveLength(0);
  });

  it('honors markdown options', () => {
    const processor = new FormatProcessor({ breaks: false });
    const element = document.createElement('section');
    element.setAttribute('data-format', 'markdown');
    element.innerHTML = 'Line1\nLine2';

    const stats = createStats();
    const warnings: string[] = [];

    processor.process(element, stats, warnings);

    expect(element.innerHTML).not.toContain('<br>');
  });
});
