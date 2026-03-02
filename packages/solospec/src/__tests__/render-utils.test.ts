import { describe, expect, it } from 'vitest';
import { dedent } from '#src/render/utils';

describe('dedent', () => {
  it('strips common indentation from uniformly indented blocks', () => {
    const input = `
      alpha
        beta
      gamma
    `;

    expect(dedent(input)).toBe([
      'alpha',
      '  beta',
      'gamma',
    ].join('\n'));
  });

  it('normalizes markdown-in-html pre indentation where only the first line is flush-left', () => {
    const input = `
{
        "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"],
        "client_id": "https://app.example/id"
      }
    `;

    expect(dedent(input)).toBe([
      '{',
      '  "@context": ["https://www.w3.org/ns/solid/oidc-context.jsonld"],',
      '  "client_id": "https://app.example/id"',
      '}',
    ].join('\n'));
  });

  it('keeps already-correct block indentation unchanged', () => {
    const input = `
if (isValid) {
  return true;
}
    `;

    expect(dedent(input)).toBe([
      'if (isValid) {',
      '  return true;',
      '}',
    ].join('\n'));
  });

  it('does not collapse hanging indents without a closing delimiter', () => {
    const input = `
sum = first +
        second +
        third
    `;

    expect(dedent(input)).toBe([
      'sum = first +',
      '        second +',
      '        third',
    ].join('\n'));
  });
});
