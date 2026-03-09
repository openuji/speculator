import type { EmitDiagnostic } from "./types.js";

export interface EmitContext {
  diagnostics: EmitDiagnostic[];
  pushWarning: (code: string, message: string, path?: string) => void;
  pushInfo: (code: string, message: string, path?: string) => void;
}

export function createEmitContext(): EmitContext {
  const diagnostics: EmitDiagnostic[] = [];

  return {
    diagnostics,
    pushWarning(code, message, path) {
      diagnostics.push({
        level: "warning",
        code,
        message,
        path,
      });
    },
    pushInfo(code, message, path) {
      diagnostics.push({
        level: "info",
        code,
        message,
        path,
      });
    },
  };
}
