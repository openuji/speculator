/**
 * @openuji/bikeshed-migrate
 *
 * Programmatic APIs for:
 * - Legacy Markdown migration (`migrate`)
 * - New Bikeshed HTML import pipeline (`importBikeshedSpec`)
 */

export { migrate } from './migrate.js';
export { migrate as migrateLegacyMarkdown } from './migrate.js';
export type { MigrationResult, MigrateOptions } from './migrate.js';
export type { SpeculatorConfig } from './build-config.js';

export { importBikeshedSpec } from './import-bikeshed-spec.js';
export type {
    ImportBikeshedSpecOptions,
    ImportBikeshedSpecResult,
    ImportDiagnostic,
} from './import-bikeshed-spec.js';
export type {
    BiblioRefNode,
    DocumentNode,
    FigureBlockNode,
    ImageAssetNode,
    ImageInlineNode,
    SemanticBlockNode,
    SemanticInlineNode,
} from './import/semantic-ir.js';
export type { BikeshedRenderer, BikeshedRenderResult } from './renderer/types.js';
export { DockerBikeshedRenderer } from './renderer/docker.js';
export { mapSemanticIrToSpecAst } from './import/map-semantic-ir-to-spec-ast.js';
export type {
    BikeshedMigrateConfig,
    ConversionDiagnostic,
    MapSemanticIrToSpecAstInput,
    MapSemanticIrToSpecAstResult,
} from './import/map-semantic-ir-to-spec-ast.js';

export { fetchBoilerplate, renderBoilerplateFile } from './boilerplate.js';
export type { BoilerplateResult, BoilerplateSlot } from './boilerplate.js';
