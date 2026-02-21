import path from 'node:path';
import type { ClientRuntimeOptions } from '#src/types';
import type { RenderUsageFlags } from '#src/render/block';

export interface LikeC4DumpInput {
  client: ClientRuntimeOptions;
  usage: RenderUsageFlags;
  fallbackWorkspacePath?: string;
}

export interface LikeC4DumpResult {
  dumpScript: string;
  data?: string;
}

export async function buildLikeC4Dump(
  input: LikeC4DumpInput
): Promise<LikeC4DumpResult> {
  if (!input.usage.likec4) {
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
      dumpScript: `<script id="spec-page-likec4-dump" type="application/json">${serialized}</script>`,
      data: serialized,
    };
  } finally {
    await likec4.dispose();
  }
}
