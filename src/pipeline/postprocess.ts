import type { PostprocessOptions,PipelinePass } from '@/types';


export interface PipelineResult {
  warnings: string[];
}

export async function postprocess(root: Element, passes: PipelinePass[], options: PostprocessOptions = {}): Promise<PipelineResult> {
  const warnings: string[] = [];
  for (const pass of passes) {
    const result = await pass.run(root, options);
    if (result && result.length) {
      warnings.push(...result);
    }
  }
  return { warnings };
}

