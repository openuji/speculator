import type { PostprocessOptions } from '../types';
import { runXrefPass } from './passes/xref';
import { runReferencesPass } from './passes/references';
import { runTocPass } from './passes/toc';

export interface PipelineResult {
  warnings: string[];
}

export async function postprocess(container: Element, options: PostprocessOptions = {}): Promise<PipelineResult> {
  const warnings: string[] = [];

  // 1) Resolve/diagnose concept links (stub: warn-only for now)
  warnings.push(...runXrefPass(container, options));

  // 2) Build references section skeleton from [[...]] anchors
  warnings.push(...runReferencesPass(container, options));

  // 3) Optional ToC generation (no-op unless a mount exists)
  runTocPass(container, options);

  return { warnings };
}
