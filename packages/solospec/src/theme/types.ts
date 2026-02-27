import type { JSX } from 'preact';
import type { Document, Block, Inline } from '@openuji/speculator';

export interface BlockRenderContext {
  basePath?: string;
  currentDocumentId: string;
  headingNumbers?: Record<string, string | undefined>;
}

export interface InlineRenderContext {
  basePath?: string;
  currentDocumentId: string;
}

export interface RenderPageVm {
  lang: string;
  titleText: string;
  titleTagText: string;
  subtitleText?: string;
  abstractText?: string;

  themeName: string;
  mode: 'auto' | 'light' | 'dark';
  w3cLogo: boolean;

  metadata?: import('@openuji/speculator').DocumentMetadata;
  metadataOptions?: import('#src/types').MetadataRenderOptions;
  toc?: import('@openuji/speculator').TocEntry[];
  includeToc?: boolean;

  document: Document;
  blockCtx: BlockRenderContext;

  safeJsonLdScriptHtml?: string;
  safeLikec4DumpScriptHtml?: string;
  safeRuntimeHeadHtml?: string;
  safeRuntimeBodyHtml?: string;
}

export interface AstComponents {
  Document: (props: { document: Document; ctx: BlockRenderContext }) => JSX.Element | null;
  Block: (props: { node: Block | import('@openuji/speculator').Section; ctx: BlockRenderContext }) => JSX.Element | null;
  Inlines: (props: { nodes?: Inline[]; ctx: InlineRenderContext }) => JSX.Element | null;
  Inline: (props: { node: Inline; ctx: InlineRenderContext }) => JSX.Element | null;
}

export interface ThemeSlots {
  Header(props: { vm: RenderPageVm }): JSX.Element | null;
  Toc(props: { vm: RenderPageVm }): JSX.Element | null;
  Layout(props: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element | null;
  FragmentShell(props: { vm: RenderPageVm; children?: JSX.Element }): JSX.Element | null;
  Components: AstComponents;
}

export interface ThemeResource {
  src: string;
  type: 'script' | 'style';
  injectTo?: 'head' | 'body';
  attrs?: Record<string, string>;
}

export interface SolospecThemeRenderer {
  name: string;
  getCss(): string;
  slots: ThemeSlots;
  runtimeImport?: string;
  resources?: ThemeResource[];
}
