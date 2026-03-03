import { describe, it, expect } from 'vitest';
import { migrate } from '../../src/migrate.js';

describe('algorithm-div transform', () => {
    it('converts <div algorithm> to <section data-algorithm>', async () => {
        const bs = `<div algorithm>
1. Do something.
</div>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('<section');
        expect(md).toContain('data-algorithm');
        expect(md).not.toContain('<div algorithm');
    });

    it('converts <div algorithm="name"> preserving the name', async () => {
        const bs = `<div algorithm="provideContext(options)">
1. TODO: fill this out.
</div>
`;
        const { md } = await migrate(bs);
        expect(md).toContain('<section');
        expect(md).not.toContain('<div algorithm');
    });
});
