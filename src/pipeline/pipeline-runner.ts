import type { PipelinePass, PassResult, SpeculatorConfig } from '../types';
import { Postprocessor } from './postprocess';

export class PipelineRunner {
  constructor(
    private readonly passFactory: (container: Element) => PipelinePass[],
  ) { }

  run(
    container: Element,
    config: SpeculatorConfig,
    passNames?: string[],
  ): Promise<PassResult> {
    const passes = this.passFactory(container);
    const processor = new Postprocessor(passes, container);
    return processor.run(config, passNames);
  }
}
