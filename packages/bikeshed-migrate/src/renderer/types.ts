import type { MetadataMap } from "../extract/metadata.js";

export type RendererDiagnosticLevel = "info" | "warning" | "error";

export interface RendererDiagnostic {
  level: RendererDiagnosticLevel;
  message: string;
  code?: string;
}

export interface BikeshedRenderResult {
  html: string;
  logs: string[];
  diagnostics: RendererDiagnostic[];
}

export interface BikeshedRenderInput {
  bsContent: string;
  metadata: MetadataMap;
  sourcePath?: string;
}

export interface BikeshedRenderer {
  render(input: BikeshedRenderInput): Promise<BikeshedRenderResult>;
}
