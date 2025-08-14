import type {
  OutputArea,
  PipelinePass,
  PostprocessOptions,
  PipelineContext,
} from '@/types';

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
    const ctx: PipelineContext = { outputs: {}, warnings: [], options };

    const active = areas
      ? this.passes.filter(p => areas.includes(p.area))
      : this.passes;

    const composed = compose(active);
    await composed(ctx);

    return { outputs: ctx.outputs, warnings: ctx.warnings };
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

function compose(passes: PipelinePass[]): (ctx: PipelineContext) => Promise<void> {
  return function run(ctx: PipelineContext): Promise<void> {
    let index = -1;
    async function dispatch(i: number): Promise<void> {
      if (i <= index) return;
      index = i;
      const pass = passes[i];
      if (!pass) return;
      await pass.run(ctx, () => dispatch(i + 1));
    }
    return dispatch(0);
  };
}
