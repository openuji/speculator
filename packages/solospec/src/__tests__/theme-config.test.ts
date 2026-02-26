import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SOLOSPEC_THEME_SETTINGS,
  resolveSolospecThemeSettings,
} from '#src/theme/config';

describe('resolveSolospecThemeSettings', () => {
  it('returns defaults when no settings are provided', () => {
    expect(resolveSolospecThemeSettings()).toEqual(DEFAULT_SOLOSPEC_THEME_SETTINGS);
  });

  it('falls back on invalid values', () => {
    const resolved = resolveSolospecThemeSettings({
      // Intentional invalid values to verify fallback behavior.
      name: 'unknown' as unknown as 'bikeshed',
      mode: 'midnight' as unknown as 'dark' | 'light' | 'system',
      themeSwitcher: true,
    });

    expect(resolved.name).toBe(DEFAULT_SOLOSPEC_THEME_SETTINGS.name);
    expect(resolved.mode).toBe(DEFAULT_SOLOSPEC_THEME_SETTINGS.mode);
    expect(resolved.themeSwitcher).toBe(true);
  });
});
