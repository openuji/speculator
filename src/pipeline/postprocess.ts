import type {
  PipelinePass,
  PassResult,
  SpeculatorConfig,
} from '@/types';

/**
 * Orchestrates execution of post-processing passes using functional composition.
 */
export class Postprocessor {
  constructor(
    private readonly passes: PipelinePass[],
    private readonly root: Element,
  ) { }

  /**
   * Run the configured passes.
   * @param config Configuration options for the passes.
   * @param passNames Optional list of pass names to run. If omitted, all passes are executed.
   */
  async run(config: SpeculatorConfig, passNames?: string[]): Promise<PassResult> {
    const active = passNames
      ? this.passes.filter(p => p.name && passNames.includes(p.name))
      : this.passes;

    const composed = compose(active, this.root, config);
    return composed();
  }
}

/**
 * Convenience function for one-off postprocessing runs.
 */
export async function postprocess(
  passes: PipelinePass[],
  root: Element,
  config: SpeculatorConfig,
  passNames?: string[],
): Promise<PassResult> {
  const processor = new Postprocessor(passes, root);
  return processor.run(config, passNames);
}

/**
 * Compose passes into a single function using functional composition.
 * Each pass receives the root, config, and a next() function that returns
 * downstream results. Passes merge their output with downstream results.
 */
function compose(
  passes: PipelinePass[],
  root: Element,
  config: SpeculatorConfig,
): () => Promise<PassResult> {
  let index = -1;

  function dispatch(i: number): Promise<PassResult> {
    if (i <= index) {
      return Promise.resolve({ warnings: [] });
    }
    index = i;
    const pass = passes[i];
    if (!pass) {
      return Promise.resolve({ warnings: [] });
    }
    return pass.run(root, config, () => dispatch(i + 1));
  }

  return () => dispatch(0);
}
