export type RedirectType = 'none' | 'netlify' | 'cloudflare' | 'json';

export interface RedirectConfig {
    type: RedirectType;
    module: 'core' | 'ui';
    latestVersion?: string;
    baseUrl?: string;
}

export interface Redirect {
    from: string;
    to: string;
    status?: number;
}

/**
 * Generate redirect rules based on configuration
 */
export function generateRedirects(config: RedirectConfig): string {
    if (config.type === 'none') {
        return '';
    }

    const redirects: Redirect[] = [];
    const pathPrefix = config.module === 'core' ? 'ns' : 'ui';

    // Trailing slash normalization
    redirects.push({
        from: `/${pathPrefix}`,
        to: `/${pathPrefix}/`,
        status: 301,
    });

    // TR latest version redirect
    if (config.latestVersion) {
        redirects.push({
            from: `/TR/${config.module}/`,
            to: `/TR/${config.module}/${config.latestVersion}/`,
            status: 302,
        });
    }

    // Format based on type
    switch (config.type) {
        case 'netlify':
            return formatNetlifyRedirects(redirects);
        case 'cloudflare':
            return formatCloudflareRedirects(redirects);
        case 'json':
            return formatJsonRedirects(redirects);
        default:
            return '';
    }
}

/**
 * Format redirects for Netlify _redirects file
 */
function formatNetlifyRedirects(redirects: Redirect[]): string {
    return redirects.map(r => `${r.from}  ${r.to}  ${r.status || 301}`).join('\n') + '\n';
}

/**
 * Format redirects for Cloudflare Pages
 */
function formatCloudflareRedirects(redirects: Redirect[]): string {
    const rules = redirects.map(r => ({
        source: r.from,
        destination: r.to,
        permanent: r.status === 301,
    }));
    return JSON.stringify({ redirects: rules }, null, 2);
}

/**
 * Format redirects as generic JSON
 */
function formatJsonRedirects(redirects: Redirect[]): string {
    return JSON.stringify(redirects, null, 2);
}
