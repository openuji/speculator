import {
  isSolospecThemeMode,
  isSolospecThemeName,
  resolveSolospecThemeSettings,
  type ResolvedSolospecThemeSettings,
  type SolospecThemeMode,
  type SolospecThemeSettings,
} from '#src/theme/config';
import { render } from 'preact';

const STORAGE_KEY = 'solospec.theme.preferences.v1';
const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)';
const ROOT_SELECTOR = '.solospec-root';
const SWITCHER_CONTAINER_CLASS = 'solospec-theme-switcher-container';

type EffectiveMode = Exclude<SolospecThemeMode, 'system'>;

interface StoredThemePreferences {
  name?: string;
  mode?: string;
}

function resolveSystemMode(): EffectiveMode {
  if (window.matchMedia(SYSTEM_DARK_QUERY).matches) {
    return 'dark';
  }
  return 'light';
}

function resolveEffectiveMode(mode: SolospecThemeMode): EffectiveMode {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }
  return resolveSystemMode();
}

function getRootElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(ROOT_SELECTOR));
}

function applyThemeAttributes(settings: ResolvedSolospecThemeSettings): void {
  const effectiveMode = resolveEffectiveMode(settings.mode);

  for (const root of getRootElements()) {
    root.setAttribute('data-solospec-theme', settings.name);
    root.setAttribute('data-solospec-mode', settings.mode);
    root.setAttribute('data-solospec-effective-mode', effectiveMode);
  }
}

function readStoredThemePreferences(): StoredThemePreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as StoredThemePreferences;
    if (!parsed || typeof parsed !== 'object') return {};

    return parsed;
  } catch {
    return {};
  }
}

function writeStoredThemePreferences(settings: ResolvedSolospecThemeSettings): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        name: settings.name,
        mode: settings.mode,
      })
    );
  } catch {
    // Ignore storage failures (private mode, denied access, etc.).
  }
}

function removeSwitchers(): void {
  const containers = document.querySelectorAll<HTMLElement>(`.${SWITCHER_CONTAINER_CLASS}`);
  for (const container of Array.from(containers)) {
    render(null, container);
    container.remove();
  }
}

function ThemeSwitcherUi({
  currentMode,
  onModeSelect,
}: {
  currentMode: SolospecThemeMode;
  onModeSelect: (mode: SolospecThemeMode) => void;
}) {
  return (
    <div
      class="solospec-theme-switcher"
      data-solospec-theme-switcher
      role="group"
      aria-label="Color mode switcher"
    >
      <span class="solospec-theme-switcher-label">Mode</span>
      {(['system', 'light', 'dark'] as const).map((mode) => {
        const isActive = currentMode === mode;
        return (
          <button
            key={mode}
            type="button"
            data-solospec-mode-value={mode}
            aria-pressed={isActive}
            data-active={isActive}
            onClick={() => onModeSelect(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        );
      })}
    </div>
  );
}

function ensureSwitcher(
  settings: ResolvedSolospecThemeSettings,
  onModeSelect: (mode: SolospecThemeMode) => void
): void {
  if (!settings.themeSwitcher) {
    removeSwitchers();
    return;
  }

  const roots = getRootElements();

  for (const root of roots) {
    let container = root.querySelector<HTMLElement>(`.${SWITCHER_CONTAINER_CLASS}`);

    if (!container) {
      container = document.createElement('div');
      container.className = SWITCHER_CONTAINER_CLASS;

      const page = root.querySelector<HTMLElement>('.spec-page');
      if (page) {
        page.insertBefore(container, page.firstChild);
      } else {
        root.insertBefore(container, root.firstChild);
      }
    }

    render(
      <ThemeSwitcherUi currentMode={settings.mode} onModeSelect={onModeSelect} />,
      container
    );
  }
}

function resolveInitialSettings(defaults: ResolvedSolospecThemeSettings): ResolvedSolospecThemeSettings {
  const stored = readStoredThemePreferences();

  return resolveSolospecThemeSettings({
    name: isSolospecThemeName(stored.name) ? stored.name : defaults.name,
    mode: isSolospecThemeMode(stored.mode) ? stored.mode : defaults.mode,
    themeSwitcher: defaults.themeSwitcher,
  });
}

function setupRuntime(defaultSettings: SolospecThemeSettings): void {
  let settings = resolveInitialSettings(resolveSolospecThemeSettings(defaultSettings));
  let detachSystemListener: (() => void) | undefined;

  const apply = () => {
    applyThemeAttributes(settings);
    ensureSwitcher(settings, (mode) => {
      settings = resolveSolospecThemeSettings({
        ...settings,
        mode,
      });

      writeStoredThemePreferences(settings);
      apply();
      watchSystemPreference();
    });
  };

  const watchSystemPreference = () => {
    if (detachSystemListener) {
      detachSystemListener();
      detachSystemListener = undefined;
    }

    if (settings.mode !== 'system') {
      return;
    }

    const media = window.matchMedia(SYSTEM_DARK_QUERY);
    const onChange = () => applyThemeAttributes(settings);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
      detachSystemListener = () => media.removeEventListener('change', onChange);
      return;
    }

    media.addListener(onChange);
    detachSystemListener = () => media.removeListener(onChange);
  };

  apply();
  watchSystemPreference();
}

export function initSolospecThemeRuntime(defaultSettings: SolospecThemeSettings = {}): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setupRuntime(defaultSettings), { once: true });
    return;
  }

  setupRuntime(defaultSettings);
}
