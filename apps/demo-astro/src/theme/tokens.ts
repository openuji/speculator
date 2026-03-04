export type ThemeTokenMap = Record<string, string>;

export interface ThemePreset {
  light: ThemeTokenMap;
  dark: ThemeTokenMap;
}

const studioLight: ThemeTokenMap = {
  "ui-canvas": "#f7f4ee",
  "ui-surface": "#fffdf9",
  "ui-elevated": "#f4efe5",
  "ui-ink-1": "#1c2133",
  "ui-ink-2": "#545d73",
  "ui-ink-3": "#7f879a",
  "ui-line": "#d8cfbf",
  "ui-brand": "#0d7f72",
  "ui-brand-soft": "#e5f5f2",
  "ui-accent": "#c36d0f",
  "ui-accent-soft": "#fff2e1",
  "ui-danger": "#b42318",
  "ui-danger-soft": "#fef0ed",
  "ui-success": "#1f7a41",
  "ui-success-soft": "#edf8f0",
  "ui-brand-hover": "#09695e",
  "ui-canvas-glow-1": "#fff9ee",
  "ui-canvas-glow-2": "#e8f7f4",
  "ui-hero-start": "#ffffff",
  "ui-hero-end": "#e8f7f3",
  "ui-header-tint": "rgba(255, 253, 249, 0.84)",
  "ui-code-surface": "#191b2b",
  "ui-code-border": "#2e324f",
  "ui-code-divider": "#32395c",
  "ui-code-ink": "#eceefa",
  "ui-code-muted": "#c9d0f8",
  "ui-radius-sm": "10px",
  "ui-radius-card": "18px",
  "ui-radius-shell": "28px",
  "ui-shadow-soft": "0 20px 45px rgba(32, 28, 21, 0.08)",
  "ui-font-sans": '"Space Grotesk", "Avenir Next", "Segoe UI", sans-serif',
  "ui-font-serif": '"Fraunces", "Iowan Old Style", "Times New Roman", serif',
  "ui-font-mono": '"Iosevka Term", "SFMono-Regular", Consolas, monospace'
};

const studioDark: ThemeTokenMap = {
  "ui-canvas": "#0b1117",
  "ui-surface": "#131c24",
  "ui-elevated": "#1a2430",
  "ui-ink-1": "#edf3ff",
  "ui-ink-2": "#b8c4d8",
  "ui-ink-3": "#8190a8",
  "ui-line": "#2e3b4f",
  "ui-brand": "#37c8b5",
  "ui-brand-soft": "#143f45",
  "ui-accent": "#ffb158",
  "ui-accent-soft": "#3a2b17",
  "ui-danger": "#ff8a7a",
  "ui-danger-soft": "#3b1d1d",
  "ui-success": "#6cd391",
  "ui-success-soft": "#153224",
  "ui-brand-hover": "#5de0ce",
  "ui-canvas-glow-1": "rgba(13, 41, 57, 0.55)",
  "ui-canvas-glow-2": "rgba(19, 63, 66, 0.45)",
  "ui-hero-start": "#172431",
  "ui-hero-end": "#122e31",
  "ui-header-tint": "rgba(19, 28, 36, 0.82)",
  "ui-code-surface": "#0e1520",
  "ui-code-border": "#2f4b63",
  "ui-code-divider": "#345067",
  "ui-code-ink": "#edf4ff",
  "ui-code-muted": "#9ac0ef",
  "ui-shadow-soft": "0 22px 45px rgba(0, 0, 0, 0.35)"
};

export const themePresets: Record<string, ThemePreset> = {
  studio: {
    light: studioLight,
    dark: {
      ...studioLight,
      ...studioDark
    }
  },
  contrast: {
    light: {
      ...studioLight,
      "ui-canvas": "#f5f7fb",
      "ui-surface": "#ffffff",
      "ui-line": "#bec7d8",
      "ui-brand": "#005ad2",
      "ui-brand-soft": "#dfeaff",
      "ui-accent": "#ba4b00",
      "ui-accent-soft": "#ffe7d8"
    },
    dark: {
      ...studioLight,
      ...studioDark,
      "ui-canvas": "#0a0f18",
      "ui-surface": "#141d2b",
      "ui-line": "#32445d",
      "ui-brand": "#5ea3ff",
      "ui-brand-soft": "#1d3558",
      "ui-accent": "#ff9b4d",
      "ui-accent-soft": "#432815"
    }
  },
  paper: {
    light: {
      ...studioLight,
      "ui-canvas": "#faf7f1",
      "ui-surface": "#fffefb",
      "ui-elevated": "#f3eee2",
      "ui-line": "#d8cfbf",
      "ui-brand": "#38587c",
      "ui-brand-soft": "#eaf0f8",
      "ui-accent": "#845a20",
      "ui-accent-soft": "#f9ecd8",
      "ui-font-sans": '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
      "ui-font-serif": '"Cormorant Garamond", "Iowan Old Style", "Times New Roman", serif'
    },
    dark: {
      ...studioLight,
      ...studioDark,
      "ui-canvas": "#101317",
      "ui-surface": "#171d24",
      "ui-elevated": "#212935",
      "ui-line": "#3b4759",
      "ui-brand": "#88add6",
      "ui-brand-soft": "#24394f",
      "ui-accent": "#d39c54",
      "ui-accent-soft": "#3e2e1d"
    }
  }
};

export type ThemePresetName = keyof typeof themePresets;

const toCssBlock = (selector: string, tokens: ThemeTokenMap): string => {
  const declarations = Object.entries(tokens)
    .map(([token, value]) => `  --${token}: ${value};`)
    .join("\n");

  return `${selector} {\n${declarations}\n}`;
};

export const serializeThemePreset = (preset: ThemePreset): string => {
  const light = toCssBlock(":root", preset.light);
  const dark = toCssBlock("  :root", preset.dark);

  return `${light}\n\n@media (prefers-color-scheme: dark) {\n${dark}\n}`;
};
