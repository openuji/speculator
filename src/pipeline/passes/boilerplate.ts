import type {
  PostprocessOptions,
  PipelinePass,
  PipelineContext,
  PipelineNext,
} from '@/types';

interface BPConfig {
  title?: string;
  id?: string;
  content?: string;
}

export interface BoilerplateSectionDescriptor {
  id: string;
  title: string;
  content?: string;
}

export interface BoilerplateOutput {
  sections: BoilerplateSectionDescriptor[];
  ref: Node | null;
}

export class BoilerplatePass implements PipelinePass {
  area = 'boilerplate' as const;
  constructor(private readonly root: Element) {}

  private async execute(
    _data: BoilerplateOutput | undefined,
    options: PostprocessOptions,
  ): Promise<{ data: BoilerplateOutput; warnings: string[] }> {
    const bp = options.boilerplate;
    if (!bp) return { data: { sections: [], ref: null }, warnings: [] };

    const mountMode = bp.mount || 'end';

    // Determine insertion reference node based on mount option
    let ref: Node | null = null;
    if (mountMode === 'before-references') {
      ref = this.root.querySelector('#references');
    } else if (mountMode === 'after-toc') {
      const toc = this.root.querySelector('#toc');
      ref = toc ? toc.nextSibling : null;
    }

    const sections: BoilerplateSectionDescriptor[] = [];

    const defs: Array<{ key: 'conformance' | 'security' | 'privacy'; title: string }> = [
      { key: 'conformance', title: 'Conformance' },
      { key: 'security', title: 'Security' },
      { key: 'privacy', title: 'Privacy' },
    ];

    for (const { key, title: defaultTitle } of defs) {
      const opt = (bp as any)[key];
      if (!opt) continue; // not enabled

      const cfg: BPConfig = typeof opt === 'object' ? opt : {};
      const id = cfg.id || key;
      if (this.root.querySelector(`#${id}`)) continue; // avoid overwriting existing sections

      const title = cfg.title || defaultTitle;
      const content = cfg.content;
      const descriptor: BoilerplateSectionDescriptor = { id, title };
      if (content !== undefined) descriptor.content = content;
      sections.push(descriptor);
    }

    return { data: { sections, ref }, warnings: [] };
  }

  async run(ctx: PipelineContext, next: PipelineNext): Promise<void> {
    const current = ctx.outputs[this.area] as BoilerplateOutput | undefined;
    const { data, warnings } = await this.execute(current, ctx.options);
    if (data !== undefined) ctx.outputs[this.area] = data;
    if (warnings && warnings.length) ctx.warnings.push(...warnings);
    await next();
  }
}
