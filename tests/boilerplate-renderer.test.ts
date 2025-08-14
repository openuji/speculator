import { BoilerplatePass } from '../src/pipeline/passes/boilerplate';
import { BoilerplateRenderer } from '../src/renderers/boilerplate-renderer';

describe('Boilerplate rendering', () => {
  it('creates boilerplate sections from descriptors', async () => {
    const doc = document.implementation.createHTMLDocument('');
    const root = doc.createElement('div');
    doc.body.appendChild(root);

    const pass = new BoilerplatePass(root);
    const { data } = await pass.run(undefined, {
      boilerplate: { conformance: true },
    } as any);

    const renderer = new BoilerplateRenderer(doc);
    const sections = renderer.render(data.sections);

    expect(sections).toHaveLength(1);
    const section = sections[0];
    expect(section.id).toBe('conformance');
    expect(section.querySelector('h2')?.textContent).toBe('Conformance');
  });
});

