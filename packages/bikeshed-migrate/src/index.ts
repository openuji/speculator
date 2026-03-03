/**
 * @openuji/bikeshed-migrate
 *
 * Programmatic API for migrating Bikeshed (.bs) specs to Speculator format.
 */

export { migrate } from './migrate.js';
export type { MigrationResult, MigrateOptions } from './migrate.js';
export type { SpeculatorConfig, RespecConfig, PersonEntry } from './build-config.js';
