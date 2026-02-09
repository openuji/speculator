/**
 * Environment Variable Interpolation Utility
 */

/**
 * Replaces ${VAR} and $VAR placeholders in a string with values from an environment object.
 * Only environment variables starting with SPEC_ are allowed for security.
 * If a variable is not defined or not allowed, it is replaced with an empty string.
 * 
 * @param content - The string containing placeholders
 * @param env - Optional environment object (defaults to process.env)
 * @returns The string with placeholders replaced
 */
export function interpolateEnvVars(content: string, env: Record<string, string | undefined> = process.env): string {
    return content.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, p1, p2) => {
        const varName = p1 || p2;
        if (!varName.startsWith('SPEC_')) {
            return ''; // Security: ignore non-prefixed variables
        }
        return env[varName] || '';
    });
}
