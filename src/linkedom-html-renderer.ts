import { DOMParser } from 'linkedom';
import type { HtmlRenderer } from './html-renderer';

/**
 * Node-specific HtmlRenderer implementation using linkedom.
 */
export class LinkedomHtmlRenderer implements HtmlRenderer {
  parse(html: string): Element {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    return doc.querySelector('div') as Element;
  }

  serialize(element: Element): string {
    return element.innerHTML;
  }
}
