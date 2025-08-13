import { Speculator as BaseSpeculator } from './speculator';
import type { SpeculatorOptions } from './types';
import { LinkedomHtmlRenderer } from './linkedom-html-renderer';

export * from './index';

export class Speculator extends BaseSpeculator {
  constructor(options: SpeculatorOptions = {}) {
    super({ ...options, htmlRenderer: options.htmlRenderer || new LinkedomHtmlRenderer() });
  }
}

export { LinkedomHtmlRenderer } from './linkedom-html-renderer';
