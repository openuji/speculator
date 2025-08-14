import { StatsTracker } from '../utils/stats-tracker';

export interface ProcessorResult {
  content?: string | null;
  error?: string;
}

export interface ElementProcessor {
  matches(element: Element): boolean;
  process(
    element: Element,
    tracker: StatsTracker,
    warnings: string[],
  ): Promise<ProcessorResult> | ProcessorResult;
}

