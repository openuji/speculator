import type { PostprocessOptions } from '../types';
import { runXrefPass } from './passes/xref';
import { runReferencesPass } from './passes/references';
import { runTocPass } from './passes/toc';
import { runIdlPass } from './passes/idl';
import { runDiagnosticsPass } from './passes/diagnostics';
import { runBoilerplatePass } from './passes/boilerplate';

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

  // 4) Boilerplate (insert after cites/refs so it can mount before/after them)
  runBoilerplatePass(container, options);

  // 5) ToC
  runTocPass(container, options);

  // 6) Diagnostics sweep (duplicates + missing hrefs, etc.)
  warnings.push(...runDiagnosticsPass(container, options.diagnostics));



  return { warnings };
}
