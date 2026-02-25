import path from 'node:path';
import type { Document } from '@openuji/speculator';

export interface LikeC4DumpInput {
  client: {
    likec4Workspace?: string;
    likec4Project?: string;
  };
  document: Document;
  fallbackWorkspacePath?: string;
}

export interface LikeC4DumpResult {
  dumpScript: string;
  data?: string;
}

function hasLikeC4(node: any): boolean {
  if (node?.type === 'likeC4View') return true;
  if (Array.isArray(node?.children)) return node.children.some(hasLikeC4);
  return false;
}

export async function buildLikeC4Dump(
  input: LikeC4DumpInput
): Promise<LikeC4DumpResult> {
  if (!hasLikeC4(input.document)) {
    return { dumpScript: '', data: '' };
  }

  const workspacePath = input.client.likec4Workspace || input.fallbackWorkspacePath;
  if (!workspacePath) {
    throw new Error(
      'LikeC4 runtime is enabled but no workspace path could be inferred. Set options.client.likec4Workspace.'
    );
  }

  const resolvedWorkspace = path.resolve(workspacePath);
  const likec4Module = await import('likec4');
  let likec4: Awaited<ReturnType<typeof likec4Module.LikeC4.fromWorkspace>>;

  try {
    likec4 = await likec4Module.LikeC4.fromWorkspace(resolvedWorkspace, {
      printErrors: false,
      throwIfInvalid: true,
    });
    } catch (error) {
    if (error instanceof Error && error.message.includes('no LikeC4 sources found')) {
      return { dumpScript: '', data: '' };
    }
    throw error;
  }

  try {
    const model = await likec4.layoutedModel(input.client.likec4Project);
    const serialized = JSON.stringify(model.$data).replace(/</g, '\\u003C');
    return {
      dumpScript: `<script id="solospec-likec4-dump" type="application/json">${serialized}</script>`,
      data: serialized,
    };
  } finally {
    await likec4.dispose();
  }
}
