import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  NodeFileProvider,
  corePlugins,
  speculate,
  type Document,
  type Workspace,
  type FileProvider,
} from '@openuji/speculator';
import { renderDocumentPage } from '#src/render/page';
import { getRuntimeInjectionScripts } from '#src/runtime/inject';
import { buildLikeC4Dump } from '#src/runtime/likec4-dump';
import type {
  RenderAstInput,
  RenderDocumentInput,
  RenderOptions,
  RenderResult,
} from '#src/types';

interface RenderWorkspaceInput {
  workspace: Workspace;
  documentId?: string;
  output?: string;
  options?: RenderOptions;
  fallbackLikeC4WorkspacePath?: string;
}

function pickDocument(workspace: Workspace, documentId?: string): Document {
  if (!workspace.documents || workspace.documents.length === 0) {
    throw new Error('Workspace has no documents to render.');
  }

  if (!documentId) {
    return workspace.documents[0];
  }

  const match = workspace.documents.find((document) => document.id === documentId);
  if (!match) {
    throw new Error(`Document "${documentId}" was not found in workspace.`);
  }

  return match;
}

function inferLikeC4WorkspacePath(document: Document): string | undefined {
  if (!document.sourcePos?.file) {
    return undefined;
  }

  return path.dirname(document.sourcePos.file);
}

async function writeOutputHtml(outputPath: string, html: string): Promise<void> {
  const absolutePath = path.resolve(outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, html, 'utf8');
}

async function renderFromWorkspace(input: RenderWorkspaceInput): Promise<RenderResult> {
  const document = pickDocument(input.workspace, input.documentId);
  const options = input.options || {};

  const firstPass = renderDocumentPage({
    document,
    options,
  });

  const likec4Dump = await buildLikeC4Dump({
    client: options.client || {},
    usage: firstPass.usage,
    fallbackWorkspacePath: input.fallbackLikeC4WorkspacePath || inferLikeC4WorkspacePath(document),
  });

  const scripts = getRuntimeInjectionScripts(firstPass.usage);

  const finalRender = renderDocumentPage({
    document,
    options,
    runtimeHeadHtml: scripts.headHtml,
    runtimeBodyHtml: scripts.bodyHtml,
    likec4DumpScript: likec4Dump.dumpScript,
  });

  if (input.output) {
    await writeOutputHtml(input.output, finalRender.html);
  }

  return {
    html: finalRender.html,
    document,
    workspace: input.workspace,
    output: input.output,
  };
}

export async function renderDocument(input: RenderDocumentInput): Promise<RenderResult> {
  const fileProvider: FileProvider = input.fileProvider || new NodeFileProvider();
  const result = await speculate({
    entry: input.entry,
    configPath: input.configPath,
    fileProvider,
    env: input.env,
    plugins: corePlugins,
  });

  if (!result.workspace) {
    throw new Error('Speculator did not produce a workspace AST for the provided entry.');
  }

  return renderFromWorkspace({
    workspace: result.workspace,
    output: input.output,
    options: input.options,
    fallbackLikeC4WorkspacePath: path.dirname(path.resolve(input.entry)),
  });
}

export async function renderAst(input: RenderAstInput): Promise<RenderResult> {
  return renderFromWorkspace({
    workspace: input.workspace,
    documentId: input.documentId,
    output: input.output,
    options: input.options,
  });
}
