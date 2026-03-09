import type { SpecConfig, SpeculatorASTSchema } from '@openuji/speculator';

export interface EmitDiagnostic {
    level: 'info' | 'warning';
    code: string;
    message: string;
    path?: string;
}

export interface EmitOptions {
    /**
     * Append trailing newline to generated files.
     * @default true
     */
    trailingNewline?: boolean;
}

export interface EmitSpecPackageInput {
    workspace: SpeculatorASTSchema;
    config: SpecConfig;
    documentId?: string;
    options?: EmitOptions;
}

export interface EmitSpecPackageResult {
    indexMd: string;
    configJson: string;
    diagnostics: EmitDiagnostic[];
    documentId: string;
}

export interface WriteSpecPackageInput extends EmitSpecPackageInput {
    outDir: string;
}

export interface WriteSpecPackageResult extends EmitSpecPackageResult {
    indexMdPath: string;
    configPath: string;
}
