/**
 * Config Module Exports
 */

export { loadConfig, ConfigLoadError } from '#src/preprocess/config/loader';
export { normalizeConfig, createDefaultConfig } from '#src/preprocess/config/normalize';

export { loadDocConfig, generateIdFromPath, getConfigPath } from '#src/preprocess/config/doc-config';
export type { 
    DocumentConfig, 
    ResolvedDocumentConfig, 
    RawRespecConfig, 
    RawPersonEntry,
    DocumentId,
    ISODateString,
    MaturityLevel,
} from '#src/preprocess/config/types';
