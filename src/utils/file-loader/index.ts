import type { FileLoader } from '../../types';
import { nodeFileLoader } from './node.js';
import { browserFileLoader } from './browser.js';

export { nodeFileLoader, browserFileLoader };

/**
 * Creates a file loader that tries multiple loaders in sequence
 */
export function createFallbackFileLoader(loaders: FileLoader[]): FileLoader {
  return async (path: string): Promise<string> => {
    let lastError: Error | undefined;

    for (const loader of loaders) {
      try {
        return await loader(path);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        continue;
      }
    }

    throw lastError || new Error(`All file loaders failed for: ${path}`);
  };
}

/**
 * Auto-detects the appropriate file loader for the current environment
 */
export function getDefaultFileLoader(): FileLoader {
  if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
    return browserFileLoader;
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    return nodeFileLoader;
  } else {
    throw new Error('Unable to detect environment for file loading. Please provide a custom fileLoader.');
  }
}
