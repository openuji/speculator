import { FormatProcessor, StatsTracker } from '../src/browser';
import type { DataFormat } from '../src/types';
import type { FormatStrategy } from '../src/browser';
import { describe, it, expect } from '@jest/globals';

describe('FormatProcessor', () => {
  it('processes inline markdown', () => {
    const processor = new FormatProcessor();
    const element = document.createElement('section');
    element.setAttribute('data-format', 'markdown');
    element.innerHTML = '## Hello\nThis is **bold** text.';

    const tracker = new StatsTracker();

    const { content, error } = processor.process(element, tracker);

    expect(error).toBeUndefined();
    expect(content).toContain('<h2 id="hello">Hello</h2>');
    expect(content).toContain('<strong>bold</strong>');
    expect(element.hasAttribute('data-format')).toBe(false);
    expect(tracker.toJSON().markdownBlocks).toBe(1);
  });

  it('honors markdown options', () => {
    const processor = new FormatProcessor({ breaks: false });
    const element = document.createElement('section');
    element.setAttribute('data-format', 'markdown');
    element.innerHTML = 'Line1\nLine2';

    const tracker = new StatsTracker();

    const { content } = processor.process(element, tracker);

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

    const tracker = new StatsTracker();
    const { content, error } = processor.process(element, tracker);

    expect(error).toBeUndefined();
    expect(content).toBe('HELLO');
  });
});
