import type { FileLoader } from '../../types';

/**
 * Default file loader for Node.js environments
 */
export const nodeFileLoader: FileLoader = async (path: string): Promise<string> => {
  const fs = await import('fs/promises');
  const { fileURLToPath } = await import('node:url');
  const urlPath = fileURLToPath(path);

  try {
    return await fs.readFile(urlPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to load file: ${path}. ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
