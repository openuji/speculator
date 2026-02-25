import type { SolospecThemeRenderer } from '#src/theme/types';
import { bikeshedSlots } from '#src/theme/themes/bikeshed/components';
import { getThemeCss } from '#src/styles/theme-css';

const bikeshedTheme: SolospecThemeRenderer = {
  name: 'bikeshed',
  getCss: () => getThemeCss('bikeshed'),
  slots: bikeshedSlots,
};

export function getThemeRenderer(name: string): SolospecThemeRenderer {
  switch (name) {
    case 'bikeshed':
    default:
      return bikeshedTheme;
  }
}
