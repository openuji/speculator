export const SOLOSPEC_THEME_NAMES = ['bikeshed'] as const;
export type SolospecThemeName = (typeof SOLOSPEC_THEME_NAMES)[number];

export const SOLOSPEC_THEME_MODES = ['light', 'dark', 'auto'] as const;
export type SolospecThemeMode = (typeof SOLOSPEC_THEME_MODES)[number];

export interface CodeHighlightThemeSettings {
  light: string;
  dark: string;
}

export interface SolospecThemeSettings {
  name?: SolospecThemeName;
  codeHighlightTheme?: CodeHighlightThemeSettings;
}

export interface ResolvedSolospecThemeSettings {
  name: SolospecThemeName;
  mode: SolospecThemeMode;
  codeHighlightTheme: CodeHighlightThemeSettings;
}

export const DEFAULT_CODE_HIGHLIGHT_THEME: CodeHighlightThemeSettings = {
  light: 'github-light',
  dark: 'github-dark',
} as const;

export const DEFAULT_SOLOSPEC_THEME_SETTINGS: ResolvedSolospecThemeSettings = {
  name: 'bikeshed',
  mode: 'auto',
  codeHighlightTheme: DEFAULT_CODE_HIGHLIGHT_THEME,
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
  

  const mode = DEFAULT_SOLOSPEC_THEME_SETTINGS.mode;
  const codeHighlightTheme = input?.codeHighlightTheme
    ? input.codeHighlightTheme
    : DEFAULT_SOLOSPEC_THEME_SETTINGS.codeHighlightTheme;

  return {
    name,
    mode,
    codeHighlightTheme,
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
  },
  default: DEFAULT_SOLOSPEC_THEME_SETTINGS,
} as const;
