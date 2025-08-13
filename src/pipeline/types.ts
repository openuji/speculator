import type { PostprocessOptions } from '../types';

export interface PipelinePass {
  run(root: Element, options: PostprocessOptions): Promise<string[]>;
}

