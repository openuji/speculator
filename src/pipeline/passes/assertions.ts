import type {
  SpeculatorConfig,
  PipelinePass,
  PipelineContext,
  PipelineNext,
} from '@/types';

export type NormativeType = 'MUST' | 'MUST NOT' | 'SHOULD' | 'MAY';

export interface AssertionItem {
  /** Standardized assertion id like UJSE-1-001 */
  id: string;
  /** The actual DOM id used for anchoring (usually same as id if we set it) */
  anchorId: string;
  /** Normative keyword type */
  type: NormativeType;
  /** Minimal text snippet for context */
  snippet: string;
}

function getSpecAndVersionFromBaseUrl(baseUrl?: string): { spec?: string; version?: string } {
  if (!baseUrl) return {};
  try {
    const url = new URL(baseUrl);
    // Expect .../<spec>/<version>/
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    const n = parts.length;
    if (n >= 2) {
      const version = parts[n - 1];
      const spec = parts[n - 2];
      return { spec, version };
    }
  } catch {
    // ignore
  }
  return {};
}

function toStandardId(prefix: string, major: string, seq: number): string {
  const n = String(seq).padStart(3, '0');
  return `${prefix}-${major}-${n}`;
}

function closestBlock(el: Element): Element | null {
  // Treat these as normative blocks
  return (el.closest('p, li, dd, dt, td, th, blockquote') as Element | null) || null;
}

function normText(el: Element): string {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}

function ensureUniqueId(root: Element, desired: string): string {
  let id = desired;
  let i = 1;
  const doc = root.ownerDocument as Document | undefined;
  while (doc && typeof (doc as any).getElementById === 'function' && (doc as any).getElementById(id)) {
    id = `${desired}-${i++}`;
  }
  return id;
}

export class AssertionsPass implements PipelinePass {
  area = 'assertions' as const;
  constructor(private readonly root: Element) {}

  private async execute(
    _data: AssertionItem[] | undefined,
    config: SpeculatorConfig,
  ): Promise<{ data: AssertionItem[]; warnings: string[] }> {
    const warnings: string[] = [];

    const { spec: specOpt, version: versionOpt } = (config.postprocess as any)?.assertions || {};
    const { spec: specFromPath, version: versionFromPath } = getSpecAndVersionFromBaseUrl(config.baseUrl);
    const spec = (specOpt || specFromPath || 'SPEC').toUpperCase();
    const version = (versionOpt || versionFromPath || '0').toString();
    const majorMatch = version.match(/^(\d+)/);
    const major = majorMatch ? majorMatch[1] : '0';

    // Collect all <em class="rfc2119"> within blocks
    const map = new Map<Element, { keywords: NormativeType[]; markers: Element[] }>();
    const markers = Array.from(this.root.querySelectorAll('em.rfc2119')) as Element[];
    for (const em of markers) {
      const block = closestBlock(em);
      if (!block) continue;
      const text = (em.textContent || '').trim().toUpperCase();
      // Normalize to one of the known types (some authors write lowercase)
      let type: NormativeType | undefined = undefined;
      if (text === 'MUST NOT') type = 'MUST NOT';
      else if (text === 'MUST') type = 'MUST';
      else if (text === 'SHOULD') type = 'SHOULD';
      else if (text === 'MAY') type = 'MAY';
      if (!type) continue;
      const entry = map.get(block) || { keywords: [], markers: [] };
      entry.keywords.push(type);
      entry.markers.push(em);
      map.set(block, entry);
    }

    if (!map.size) return { data: [], warnings };

    // Determine document order of blocks by scanning relevant block elements
    const selectors = 'p, li, dd, dt, td, th, blockquote';
    const blocksInOrder = Array.from(this.root.querySelectorAll(selectors)).filter(el => map.has(el as Element)) as Element[];

    const items: AssertionItem[] = [];
    let seq = 1;

    for (const block of blocksInOrder) {
      const { keywords } = map.get(block)!;
      if (keywords.length > 1) {
        warnings.push(
          `Multiple normative keywords (${keywords.join(', ')}) in block: "${normText(block)}"`,
        );
      }
      // Choose the first as the assertion type
      const type = keywords[0];

      // Generate standardized id
      const standardId = toStandardId(spec, major, seq++);

      // Ensure an anchor id exists (prefer standardized if missing)
      let anchorId = (block as HTMLElement).id;
      if (!anchorId) {
        anchorId = ensureUniqueId(this.root, standardId);
        (block as HTMLElement).id = anchorId;
      }

      // Mark data-assertion-id always
      (block as HTMLElement).setAttribute('data-assertion-id', standardId);

      items.push({ id: standardId, anchorId, type, snippet: normText(block) });
    }

    return { data: items, warnings };
  }

  async run(ctx: PipelineContext, next: PipelineNext): Promise<void> {
    const current = ctx.outputs[this.area] as AssertionItem[] | undefined;
    const { data, warnings } = await this.execute(current, ctx.config);
    if (data !== undefined) ctx.outputs[this.area] = data;
    if (warnings && warnings.length) ctx.warnings.push(...warnings);
    await next();
  }
}
