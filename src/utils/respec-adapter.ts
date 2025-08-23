/**
 * Utilities for adapting legacy ReSpec configuration objects to the
 * {@link SpeculatorConfig} format.
 *
 * Only a very small subset of ReSpec options are understood.  Unsupported
 * properties are copied through unchanged but are ignored by Speculator.
 *
 * Supported mappings:
 * - `specStatus`  → `metadata.status`
 * - `shortName`   → `metadata.shortName`
 * - `localBiblio` → `postprocess.biblio.entries`
 * - `lint`        → `postprocess.diagnostics.idsAndLinks`
 *
 * Default behaviour:
 * - If `localBiblio` is omitted, no local bibliography entries are defined.
 * - Diagnostics are enabled unless `lint` is explicitly `false`.
 *
 * Any other ReSpec options are currently unsupported.
 */
import type { RespecConfig, SpeculatorConfig } from '../types';

/**
 * Convert a ReSpec-style configuration object into a {@link SpeculatorConfig}.
 */
export function fromRespecConfig(respec: RespecConfig): SpeculatorConfig {
  const { specStatus, shortName, localBiblio, lint, ...rest } = respec as any;
  const config: SpeculatorConfig = { ...rest };

  if (specStatus) {
    config.metadata = { ...config.metadata, status: specStatus };
  }

  if (shortName) {
    config.metadata = { ...config.metadata, shortName };
  }

  if (localBiblio && typeof localBiblio === 'object') {
    config.postprocess = { ...config.postprocess };
    const entries = {
      ...(config.postprocess?.biblio?.entries || {}),
      ...localBiblio,
    };
    config.postprocess.biblio = { ...(config.postprocess.biblio || {}), entries };
  }

  if (lint !== undefined) {
    config.postprocess = { ...config.postprocess };
    const diagnostics = { ...(config.postprocess.diagnostics || {}) };
    if (lint === false) {
      diagnostics.idsAndLinks = false;
    } else if (lint === true) {
      diagnostics.idsAndLinks = true;
    }
    config.postprocess.diagnostics = diagnostics;
  }

  return config;
}
