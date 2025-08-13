import { SpeculatorError } from './types';

/**
 * Abstraction over DOM parsing and serialization, allowing custom implementations.
 */
export interface HtmlRenderer {
  parse(html: string): Element;
  serialize(element: Element): string;
}

/**
 * Default DOM-based implementation using DOMParser.
 */
export class DOMHtmlRenderer implements HtmlRenderer {
  parse(html: string): Element {
    if (typeof DOMParser === 'undefined') {
      throw new SpeculatorError('DOMParser not available. This method requires a browser environment or jsdom.');
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    return doc.body.firstElementChild as Element;
  }

  serialize(element: Element): string {
    return element.innerHTML;
  }
}
