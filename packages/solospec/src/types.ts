import type { SolospecThemeSettings } from '#src/theme/config';

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

export interface RenderOptions {
  metadata?: MetadataRenderOptions;
  basePath?: string;
  language?: string;
  includeToc?: boolean;
  includeStyles?: boolean;
  theme?: SolospecThemeSettings;
  client?: {
    likec4Workspace?: string;
    likec4Project?: string;
  };
}


declare module 'preact' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'spec-mermaid': preact.JSX.HTMLAttributes<HTMLElement>;
      'spec-likec4': preact.JSX.HTMLAttributes<HTMLElement> & {
        'view-id'?: string;
        'dynamic-variant'?: string;
      };
    }
  }
}
