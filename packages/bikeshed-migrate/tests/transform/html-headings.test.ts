import { describe, it, expect } from 'vitest';
import { migrate } from '../../src/migrate.js';

describe('html-headings transform', () => {
    it('converts <h2 id="x"> to markdown heading', async () => {
        const bs = `<h2 id="intro">Introduction</h2>

Some content.
`;
        const { md } = await migrate(bs);
        expect(md).toContain('## Introduction ##');
        expect(md).toContain('{#intro}');
        expect(md).not.toContain('<h2');
    });

    it('converts <h3 id="x"> to depth-3 heading', async () => {
        const bs = `<h3 id="sub">Sub Section</h3>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('### Sub Section ###');
        expect(md).toContain('{#sub}');
    });

    it('converts heading without id (no id suffix)', async () => {
        const bs = `<h2>No ID Heading</h2>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('## No ID Heading ##');
        expect(md).not.toContain('{#');
    });
});
