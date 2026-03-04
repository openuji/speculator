import {
  isSolospecThemeMode,
  isSolospecThemeName,
  resolveSolospecThemeSettings,
  type ResolvedSolospecThemeSettings,
  type SolospecThemeMode,
  type SolospecThemeSettings,
} from '#src/theme/config';
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';

const getRoot = () => document.querySelector('[data-solospec-theme="bikeshed"]') as HTMLElement;

const getMediaQuery = () => {
    const root = getRoot();
    if (!root) return null;
    const computedStyle = window.getComputedStyle(root);
    const breakpoint = computedStyle.getPropertyValue('--breakpoint-mobile').trim() || '1247px';
    return window.matchMedia(`(max-width: ${breakpoint})`);
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded bikeshed');
    const root = document.querySelector('[data-solospec-theme="bikeshed"]') as HTMLElement;
    if (!root) return;

    const toc = document.getElementById('toc');
    if (!toc) return;

    
    
    const mobileToc = toc.cloneNode(true) as HTMLElement;
    mobileToc.setAttribute('id', 'toc-mobile');
    
    const mq = getMediaQuery();
    if (!mq) return;
    
    const firstLink = toc.querySelector('a[href^="#"]');
    if(!firstLink) return;
    
    const targetId = firstLink.getAttribute('href')?.substring(1);
    const targetSection = root.querySelector(`section#${targetId}`);
    const parent = targetSection?.parentNode;
    if(!targetSection || !parent) return;

    const updateToc = () => {
      if (mq.matches) {
        // Move TOC inline
        targetSection.before(mobileToc);
        root.setAttribute('data-toc-inline', 'true');
      } else {
        // Restore TOC to sidebar
        if(mobileToc.parentNode) {
          mobileToc.parentNode.removeChild(mobileToc);
        }
        root.removeAttribute('data-toc-inline');
      }
    };

    mq.addEventListener('change', updateToc);
    updateToc();

    // Setup global click handler for copy buttons
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      const isUiCopyBtn = target.closest('.ui-code-copy-btn');
      const isIdlCopyBtn = target.closest('.idl-copy-btn');
      
      if (isUiCopyBtn || isIdlCopyBtn) {
        const btn = (isUiCopyBtn || isIdlCopyBtn) as HTMLButtonElement;
        
        let textToCopy = '';
        if (isUiCopyBtn) {
          textToCopy = btn.closest('.ui-code-block')?.querySelector('code')?.textContent || '';
        } else if (isIdlCopyBtn) {
          textToCopy = btn.closest('.idl-block')?.querySelector('.idl-block-code')?.textContent || '';
        }
        
        if (textToCopy) {
          navigator.clipboard.writeText(textToCopy).then(() => {
            btn.classList.add('copied');
            setTimeout(() => btn.classList.remove('copied'), 300);
          }).catch(err => {
            console.error('Failed to copy text: ', err);
          });
        }
      }
    });

  })

}

function useMediaQuery(): boolean {
  const [matches, setMatches] = useState(false);

  

  useEffect(() => {
   
    const mq = getMediaQuery();
    if (!mq) return;
    if (mq.matches !== matches) {
      setMatches(mq.matches);
    }
    const listener = () => setMatches(mq.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  return matches;
}




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

function TocNav({
  currentMode,
  onModeSelect,
}: {
  currentMode: SolospecThemeMode;
  onModeSelect: (mode: SolospecThemeMode) => void;
}) {
  const isMobile = useMediaQuery();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const tocId = isMobile ? 'toc-mobile' : 'toc';

  const collapseToc = () => {
    const root = getRoot();
    if (!root) return;
    setIsCollapsed(true);
  };

  const expandToc = () => {
    const root = getRoot();
    if (!root) return;
    setIsCollapsed(false);
  };

  useEffect(() => {
    const root = getRoot();
    if (!root) return;
    if (isCollapsed) {
      root.classList.add('toc-collapsed');
      root.classList.remove('toc-expanded');
    } else {
      root.classList.remove('toc-collapsed');
      if(isMobile) {
        root.classList.add('toc-expanded');
      }
    }
  }, [isCollapsed, isMobile]);

  useEffect(() => {
    if(isMobile) {
      setIsCollapsed(true);
    }
    else {
      setIsCollapsed(false);
    }
  }, [isMobile]);

  return (
    <p id="toc-nav">
      {isMobile && isCollapsed && <a id="toc-jump" href={`#${tocId}`} aria-labelledby="toc-jump-text">
        <span aria-hidden="true">↑ </span>
        <span id="toc-jump-text">Jump to Table of Contents</span>
      </a>}
      {(isCollapsed) && <a id="toc-toggle" href="#toc" onClick={expandToc} aria-labelledby="toc-expand-text">
        <span aria-hidden="true">→ </span>
        <span id="toc-expand-text">Pop Out Sidebar</span>
      </a>}
      {!isCollapsed && <a id="toc-collapse" onClick={collapseToc} aria-labelledby="toc-collapse-text">
       <span aria-hidden="true">←</span>
        <span id="toc-collapse-text">Collapse Sidebar</span>
      </a>}
      <a id="toc-theme-toggle" role="radiogroup" aria-label="Select a color scheme">
        <span aria-hidden="true">
          <img
            src="https://www.w3.org/StyleSheets/TR/2021/logos/dark.svg"
            title="theme toggle icon"
          />
        </span>
        {(['light', 'dark', 'auto'] as const).map((mode) => {
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
              {mode}
            </button>
          );
        })}
      </a>
    </p>
  );
}


// function ThemeSwitcherUi({
//   currentMode,
//   onModeSelect,
// }: {
//   currentMode: SolospecThemeMode;
//   onModeSelect: (mode: SolospecThemeMode) => void;
// }) {
//   return (
//     <div
//       class="solospec-theme-switcher"
//       data-solospec-theme-switcher
//       role="group"
//       aria-label="Color mode switcher"
//     >
//       <span class="solospec-theme-switcher-label">Mode</span>
//       {(['system', 'light', 'dark'] as const).map((mode) => {
//         const isActive = currentMode === mode;
//         return (
//           <button
//             key={mode}
//             type="button"
//             data-solospec-mode-value={mode}
//             aria-pressed={isActive}
//             data-active={isActive}
//             onClick={() => onModeSelect(mode)}
//           >
//             {mode[0].toUpperCase() + mode.slice(1)}
//           </button>
//         );
//       })}
//     </div>
//   );
// }

function ensureSwitcher(
  settings: ResolvedSolospecThemeSettings,
  onModeSelect: (mode: SolospecThemeMode) => void
): void {
  
  const roots = getRootElements();

  for (const root of roots) {
    let container = root.querySelector<HTMLElement>(`.${SWITCHER_CONTAINER_CLASS}`);

    if (!container) {
      container = document.createElement('div');
      container.className = SWITCHER_CONTAINER_CLASS;

      const page = root.querySelector<HTMLElement>('.solospec-root');
      if (page) {
        page.insertBefore(container, page.firstChild);
      } else {
        root.insertBefore(container, root.firstChild);
      }
    }

    render(
      <TocNav currentMode={settings.mode} onModeSelect={onModeSelect} />,
      container
    );
  }
}

function resolveInitialSettings(defaults: ResolvedSolospecThemeSettings): ResolvedSolospecThemeSettings {
  const stored = readStoredThemePreferences();

  const settings = resolveSolospecThemeSettings({
    name: isSolospecThemeName(stored.name) ? stored.name : defaults.name,
  });

  if (isSolospecThemeMode(stored.mode)) {
    settings.mode = stored.mode;
  }

  return settings;
}

function setupRuntime(defaultSettings: SolospecThemeSettings): void {
  let settings = resolveInitialSettings(resolveSolospecThemeSettings(defaultSettings));
  let detachSystemListener: (() => void) | undefined;

  const apply = () => {
    applyThemeAttributes(settings);
    ensureSwitcher(settings, (mode) => {
      settings = {
        ...settings,
        mode,
      };

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

    if (settings.mode !== 'auto') {
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
