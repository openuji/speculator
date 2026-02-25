import { BIKESHED_THEME_CSS } from '#src/styles/generated/bikeshed.css';
import type { SolospecThemeName } from '#src/theme/config';

export function getThemeCss(theme: SolospecThemeName): string {
  switch (theme) {
    case 'bikeshed':
    default:
      return BIKESHED_THEME_CSS;
  }
}
