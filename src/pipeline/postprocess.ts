import type { PostprocessOptions } from '../types';
import { runXrefPass } from './passes/xref';
import { runReferencesPass } from './passes/references';
import { runTocPass } from './passes/toc';
import { runIdlPass } from './passes/idl';

export interface PipelineResult {
  warnings: string[];
}

export async function postprocess(container: Element, options: PostprocessOptions = {}): Promise<PipelineResult> {
  const warnings: string[] = [];


  // 1) IDL: parse blocks, export anchors, resolve {{ ... }}
  warnings.push(...runIdlPass(container, options));

  // 2) Concepts: resolve [= ... =] locally (and possibly externally in future)
  warnings.push(...runXrefPass(container, options));

  // 3) Build references section skeleton from [[...]] anchors
  warnings.push(...runReferencesPass(container, options));

  // 4) Optional ToC generation (no-op unless a mount exists)
  runTocPass(container, options);

  return { warnings };
}
