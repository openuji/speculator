import { describe, it, expect } from '@jest/globals';
import { exportAssertions } from '../src/cli/export-assertions';

describe('speculator CLI: export:assertion', () => {
  const html = `
    <section>
      <p>Alpha <em class="rfc2119">MUST</em> do A.</p>
      <p>Beta <em class="rfc2119">SHOULD</em> do B.</p>
      <p id="keep">Gamma <em class="rfc2119">MAY</em> do C.</p>
      <ul>
        <li>Delta <em class="rfc2119">MUST</em> do D and <em class="rfc2119">SHOULD</em> consider E.</li>
      </ul>
    </section>
  `;

  it('writes assertions.json and returns items', async () => {
    const writes: Record<string, string> = {};
    const io = {
      readFile: async () => html,
      writeFile: async (p: string, data: string) => {
        writes[p] = data;
      },
      stat: async () => ({ isFile: () => true }),
    };

    const input = '/virtual/spec/ujse/1.0/index.spec.html';
    const base = 'https://spec.openuji.dev/ujse/1.0/';
    const out = 'assertions.json';
    const res = await exportAssertions([
      '--input', input,
      '--base', base,
      '--out', out,
    ], io);

    expect(res.exitCode).toBe(0);
    expect(res.outPath).toBe(out);
    expect(Object.keys(writes)).toContain(out);
    const json = JSON.parse(writes[out]);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(4);
    expect(json[0]).toMatchObject({ id: 'UJSE-1-001', url: `${base}#UJSE-1-001`, type: 'MUST' });
    expect(json[1]).toMatchObject({ id: 'UJSE-1-002', url: `${base}#UJSE-1-002`, type: 'SHOULD' });
    expect(json[2]).toMatchObject({ id: 'UJSE-1-003', url: `${base}#keep`, type: 'MAY' });
  });

  it('returns exit code 2 in --strict when multiple keywords in block', async () => {
    const io = {
      readFile: async () => html,
      writeFile: async () => {},
      stat: async () => ({ isFile: () => true }),
    };
    const res = await exportAssertions([
      '--input', '/virtual/spec/ujse/1.0/index.spec.html',
      '--base', 'https://example.test/ujse/1.0/',
      '--strict',
    ], io);
    expect(res.exitCode).toBe(2);
    expect(res.warnings.some(w => /Multiple normative keywords/.test(w))).toBe(true);
  });
});

