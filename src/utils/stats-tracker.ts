import type { ProcessingStats } from '../types';

export class StatsTracker {
  private _stats: ProcessingStats = {
    elementsProcessed: 0,
    filesIncluded: 0,
    markdownBlocks: 0,
    processingTime: 0,
  };
  private startTime: number | null = null;

  start(): void {
    this.startTime = performance.now();
  }

  stop(): void {
    if (this.startTime !== null) {
      this._stats.processingTime += performance.now() - this.startTime;
      this.startTime = null;
    }
  }

  incrementElements(count = 1): void {
    this._stats.elementsProcessed += count;
  }

  incrementFiles(count = 1): void {
    this._stats.filesIncluded += count;
  }

  incrementMarkdownBlocks(count = 1): void {
    this._stats.markdownBlocks += count;
  }

  toJSON(): ProcessingStats {
    return { ...this._stats };
  }
}

