import { Postprocessor } from '../src/pipeline/postprocess';
import type { PipelinePass, PipelineContext, OutputArea, SpeculatorConfig } from '../src/types';

class TestPass implements PipelinePass {
  area: OutputArea;
  private name: string;
  private log: string[];
  private stop: boolean;
  constructor(area: OutputArea, name: string, log: string[], stop?: boolean) {
    this.area = area;
    this.name = name;
    this.log = log;
    this.stop = !!stop;
  }
  async run(_ctx: PipelineContext, next: () => Promise<void>): Promise<void> {
    this.log.push(this.name);
    if (!this.stop) {
      await next();
    }
  }
}

describe('postprocessor pass chaining', () => {
  it('runs passes in sequence', async () => {
    const log: string[] = [];
    const passes: PipelinePass[] = [
      new TestPass('metadata', 'a', log),
      new TestPass('metadata', 'b', log),
    ];
    const processor = new Postprocessor(passes);
    await processor.run({} as SpeculatorConfig);
    expect(log).toEqual(['a', 'b']);
  });

  it('supports early exit when next is not called', async () => {
    const log: string[] = [];
    const passes: PipelinePass[] = [
      new TestPass('metadata', 'a', log, true),
      new TestPass('metadata', 'b', log),
    ];
    const processor = new Postprocessor(passes);
    await processor.run({} as SpeculatorConfig);
    expect(log).toEqual(['a']);
  });
});
