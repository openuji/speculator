import { FormatProcessor } from '../src/browser';
import type { ProcessingStats, DataFormat } from '../src/types';
import type { FormatStrategy } from '../src/browser';
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

    const { content, error } = processor.process(element, stats);

    expect(error).toBeUndefined();
    expect(content).toContain('<h2 id="hello">Hello</h2>');
    expect(content).toContain('<strong>bold</strong>');
    expect(element.hasAttribute('data-format')).toBe(false);
    expect(stats.markdownBlocks).toBe(1);
  });

  it('honors markdown options', () => {
    const processor = new FormatProcessor({ breaks: false });
    const element = document.createElement('section');
    element.setAttribute('data-format', 'markdown');
    element.innerHTML = 'Line1\nLine2';

    const stats = createStats();

    const { content } = processor.process(element, stats);

    expect(content).not.toContain('<br>');
  });

  it('throws on unsupported formats', () => {
    const processor = new FormatProcessor();
    expect(() => processor.processContent('test', 'xml' as DataFormat)).toThrow(
      'Unsupported format: xml'
    );
  });

  it('allows custom strategies', () => {
    const upper: FormatStrategy = {
      convert: (c: string) => c.toUpperCase(),
    };
    const processor = new FormatProcessor({}, { upper });

    const element = document.createElement('div');
    element.setAttribute('data-format', 'upper');
    element.textContent = 'hello';

    const stats = createStats();
    const { content, error } = processor.process(element, stats);

    expect(error).toBeUndefined();
    expect(content).toBe('HELLO');
  });
});
