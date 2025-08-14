import type { OutputArea, PipelinePass, PostprocessOptions } from '@/types';

export interface PipelineResult {
  /** Map of data produced by passes, keyed by their output area. */
  outputs: Partial<Record<OutputArea, unknown>>;
  /** Accumulated warnings from all executed passes. */
  warnings: string[];
}

/**
 * Orchestrates execution of post-processing passes.
 */
export class Postprocessor {
  constructor(private readonly passes: PipelinePass[]) {}

  /**
   * Run the configured passes.
   * @param areas Optional list of output areas to run. If omitted, all passes
   *              are executed.
   * @param options Configuration options for the passes.
   */
  async run(
    areas?: OutputArea[],
    options: PostprocessOptions = {},
  ): Promise<PipelineResult> {
    const warnings: string[] = [];
    const outputs: Partial<Record<OutputArea, unknown>> = {};

    const active = areas
      ? this.passes.filter(p => areas.includes(p.area))
      : this.passes;

    for (const pass of active) {
      const current = outputs[pass.area];
      const result = await pass.run(current, options);
      if (result.data !== undefined) {
        outputs[pass.area] = result.data;
      }
      if (result.warnings && result.warnings.length) {
        warnings.push(...result.warnings);
      }
    }

    return { outputs, warnings };
  }
}

/**
 * Convenience function mirroring the previous API. A one-off postprocessing run
 * can be performed without manually instantiating the {@link Postprocessor}.
 */
export async function postprocess(
  passes: PipelinePass[],
  areas?: OutputArea[],
  options: PostprocessOptions = {},
): Promise<PipelineResult> {
  const processor = new Postprocessor(passes);
  return processor.run(areas, options);
}
