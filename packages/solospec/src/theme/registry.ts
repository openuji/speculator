import type { SolospecThemeRenderer } from '#src/theme/types';
import { bikeshedSlots } from '#src/theme/themes/bikeshed/components';
import { getThemeCss } from '#src/styles/theme-css';

const bikeshedTheme: SolospecThemeRenderer = {
  name: 'bikeshed',
  getCss: () => getThemeCss('bikeshed'),
  slots: bikeshedSlots,
  runtimeImport: '@openuji/solospec/themes/bikeshed/runtime',
  resources: [
    {
      type: 'link',
      injectTo: 'head',
      attrs: {
        rel: 'icon',
        href: 'https://www.w3.org/2008/site/images/favicon.ico',
      }
    }
  ]
};

export function getThemeRenderer(name: string): SolospecThemeRenderer {
  switch (name) {
    case 'bikeshed':
    default:
      return bikeshedTheme;
  }
}
