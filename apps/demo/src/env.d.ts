/// <reference types="astro/client" />
/// <reference types="likec4/vite-plugin-modules" />
declare module 'likec4:react' {
  import type { FunctionComponent } from 'react';
  export const LikeC4View: FunctionComponent<{
    viewId: string;
    dynamicVariant?: 'diagram' | 'sequence';
    dynamicViewVariant?: 'diagram' | 'sequence';
    enableDynamicViewWalkthrough?: boolean;
    [key: string]: unknown;
  }>;
}
