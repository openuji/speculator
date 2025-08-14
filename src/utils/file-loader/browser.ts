import type { FileLoader } from '../../types';

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
