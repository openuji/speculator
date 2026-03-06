import { fetchBoilerplate, type BoilerplateResult } from './boilerplate.js';
import type { MetadataMap } from './extract/metadata.js';

export interface BoilerplateResolver {
    resolve(metadata: MetadataMap): Promise<BoilerplateResult>;
}

export class DefaultBoilerplateResolver implements BoilerplateResolver {
    async resolve(metadata: MetadataMap): Promise<BoilerplateResult> {
        const group = getMetadataString(metadata, 'group');
        const status = getMetadataString(metadata, 'status');
        if (!group || !status) {
            return {};
        }
        return fetchBoilerplate(group, status);
    }
}

export function getMetadataString(
    metadata: MetadataMap,
    key: string,
): string | undefined {
    const value = metadata.get(key.toLowerCase());
    if (!value) return undefined;
    return Array.isArray(value) ? value[0] : value;
}
