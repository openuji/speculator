/**
 * Extract inline resource blocks (<style>, <script>) from Bikeshed source.
 */

export interface Resource {
    type: 'style' | 'script';
    content: string;
}

export interface ExtractResourcesResult {
    resources: Resource[];
    rest: string;
}

/**
 * Extract and strip <style> and <script> blocks in source order.
 */
export function extractResources(content: string): ExtractResourcesResult {
    const resources: Resource[] = [];
    const blockRe = /<(style|script)\b[^>]*>([\s\S]*?)<\/\1>/gi;

    const rest = content.replace(blockRe, (_match, tag: string, inner: string) => {
        const type = tag.toLowerCase() === 'style' ? 'style' : 'script';
        resources.push({ type, content: inner.trim() });
        return '';
    });

    return { resources, rest };
}
