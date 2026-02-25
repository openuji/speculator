export const SOLOSPEC_THEME_NAMES = ['bikeshed'] as const;
export type SolospecThemeName = (typeof SOLOSPEC_THEME_NAMES)[number];

export const SOLOSPEC_THEME_MODES = ['system', 'light', 'dark'] as const;
export type SolospecThemeMode = (typeof SOLOSPEC_THEME_MODES)[number];

export interface SolospecThemeSettings {
  name?: SolospecThemeName;
  mode?: SolospecThemeMode;
  themeSwitcher?: boolean;
  w3cLogo?: boolean;
}

export interface ResolvedSolospecThemeSettings {
  name: SolospecThemeName;
  mode: SolospecThemeMode;
  themeSwitcher: boolean;
  w3cLogo: boolean;
}

export const DEFAULT_SOLOSPEC_THEME_SETTINGS: ResolvedSolospecThemeSettings = {
  name: 'bikeshed',
  mode: 'system',
  themeSwitcher: false,
  w3cLogo: false,
};

const THEME_NAME_SET = new Set<string>(SOLOSPEC_THEME_NAMES);
const THEME_MODE_SET = new Set<string>(SOLOSPEC_THEME_MODES);

export function isSolospecThemeName(value: unknown): value is SolospecThemeName {
  return typeof value === 'string' && THEME_NAME_SET.has(value);
}

export function isSolospecThemeMode(value: unknown): value is SolospecThemeMode {
  return typeof value === 'string' && THEME_MODE_SET.has(value);
}

export function resolveSolospecThemeSettings(
  input?: SolospecThemeSettings | null
): ResolvedSolospecThemeSettings {
  const name = isSolospecThemeName(input?.name)
    ? input.name
    : DEFAULT_SOLOSPEC_THEME_SETTINGS.name;
  const mode = isSolospecThemeMode(input?.mode)
    ? input.mode
    : DEFAULT_SOLOSPEC_THEME_SETTINGS.mode;
  const themeSwitcher =
    typeof input?.themeSwitcher === 'boolean'
      ? input.themeSwitcher
      : DEFAULT_SOLOSPEC_THEME_SETTINGS.themeSwitcher;
  const w3cLogo =
    typeof input?.w3cLogo === 'boolean'
      ? input.w3cLogo
      : DEFAULT_SOLOSPEC_THEME_SETTINGS.w3cLogo;

  return {
    name,
    mode,
    themeSwitcher,
    w3cLogo,
  };
}

export const SOLOSPEC_THEME_SETTINGS_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://openuji.dev/schemas/solospec-theme-settings.schema.json',
  title: 'SolospecThemeSettings',
  description: 'Visual skin and color-mode configuration for @openuji/solospec.',
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {
      type: 'string',
      enum: SOLOSPEC_THEME_NAMES,
      default: DEFAULT_SOLOSPEC_THEME_SETTINGS.name,
      description: 'Visual skin name.',
    },
    mode: {
      type: 'string',
      enum: SOLOSPEC_THEME_MODES,
      default: DEFAULT_SOLOSPEC_THEME_SETTINGS.mode,
      description: 'Color mode preference.',
    },
    themeSwitcher: {
      type: 'boolean',
      default: DEFAULT_SOLOSPEC_THEME_SETTINGS.themeSwitcher,
      description: 'Whether to render the built-in theme/mode switcher UI.',
    },
    w3cLogo: {
      type: 'boolean',
      default: DEFAULT_SOLOSPEC_THEME_SETTINGS.w3cLogo,
      description: 'Whether to render the W3C logo in the bikeshed theme.',
    },
  },
  default: DEFAULT_SOLOSPEC_THEME_SETTINGS,
} as const;
