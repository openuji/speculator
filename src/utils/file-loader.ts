import type { FileLoader } from '../types';

/**
 * Default file loader for Node.js environments
 */
export const nodeFileLoader: FileLoader = async (path: string): Promise<string> => {
  const fs = await import('fs/promises');
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load file: ${path}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Default file loader for browser environments
 */
export const browserFileLoader: FileLoader = async (path: string): Promise<string> => {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch file: ${path}. ${error instanceof Error ? error.message : 'Network error'}`);
  }
};

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
