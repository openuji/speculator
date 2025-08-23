import type { PipelinePass, OutputArea, SpeculatorConfig } from '../types';
import { Postprocessor, type PipelineResult } from './postprocess';

export class PipelineRunner {
  constructor(private readonly passFactory: (container: Element) => PipelinePass[]) {}

  run(
    container: Element,
    areas: OutputArea[],
    config: SpeculatorConfig,
  ): Promise<PipelineResult> {
    const passes = this.passFactory(container);
    const processor = new Postprocessor(passes);
    return processor.run(areas, config);
  }
}

