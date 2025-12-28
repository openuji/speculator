/**
 * Config Module Exports
 */

export { loadRespecConfig } from '#src/preprocess/config/loader';
export type { RawRespecConfig, RawPersonEntry } from '#src/preprocess/config/loader';

export { normalizeRespecConfig, createDefaultConfig } from '#src/preprocess/config/normalize';

export { loadDocConfig, generateIdFromPath, getConfigPath } from '#src/preprocess/config/doc-config';
export type { DocumentConfig, ResolvedDocumentConfig } from '#src/preprocess/config/types';
