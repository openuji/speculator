import type { Document, FileProvider, Workspace } from '@openuji/speculator';

export type MetadataRowKey =
  | 'status'
  | 'shortName'
  | 'version'
  | 'publishDate'
  | 'lastUpdateDate'
  | 'maturityLevel'
  | 'group'
  | 'repository'
  | 'editors'
  | 'authors'
  | 'deps'
  | 'license'
  | 'copyright';

export interface MetadataRenderOptions {
  rowOrder?: MetadataRowKey[];
}

export interface ClientRuntimeOptions {
  likec4Workspace?: string;
  likec4Project?: string;
}

export interface RenderOptions {
  metadata?: MetadataRenderOptions;
  client?: ClientRuntimeOptions;
  basePath?: string;
  language?: string;
  includeToc?: boolean;
  includeStyles?: boolean;
}

export interface RenderDocumentInput {
  entry: string;
  configPath?: string;
  output?: string;
  options?: RenderOptions;
  fileProvider?: FileProvider;
  env?: Record<string, string | undefined>;
}

export interface RenderAstInput {
  workspace: Workspace;
  documentId?: string;
  output?: string;
  options?: RenderOptions;
}

export interface RenderResult {
  html: string;
  document: Document;
  workspace: Workspace;
  output?: string;
}
