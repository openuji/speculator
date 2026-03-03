/**
 * @openuji/bikeshed-migrate
 *
 * Programmatic API for migrating Bikeshed (.bs) specs to Speculator format.
 */

export { migrate } from './migrate.js';
export type { MigrationResult, MigrateOptions, Resource } from './migrate.js';
export type { SpeculatorConfig, RespecConfig, PersonEntry } from './build-config.js';
export { fetchBoilerplate, renderBoilerplateFile } from './boilerplate.js';
export type { BoilerplateResult, BoilerplateSlot } from './boilerplate.js';
