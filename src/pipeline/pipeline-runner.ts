import type { PipelinePass, OutputArea, SpeculatorOptions } from '../types';
import { Postprocessor, type PipelineResult } from './postprocess';

export class PipelineRunner {
  constructor(
    private readonly passFactory: (container: Element) => PipelinePass[],
    private readonly postprocessOptions: SpeculatorOptions['postprocess'],
  ) {}

  run(container: Element, areas: OutputArea[]): Promise<PipelineResult> {
    const passes = this.passFactory(container);
    const processor = new Postprocessor(passes);
    return processor.run(areas, this.postprocessOptions || {});
  }
}

