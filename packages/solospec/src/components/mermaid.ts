import mermaid from 'mermaid';

let pendingNodes: HTMLElement[] = [];
let renderScheduled = false;

function scheduleRender(node: HTMLElement) {
  pendingNodes.push(node);
  if (!renderScheduled) {
    renderScheduled = true;
    queueMicrotask(() => {
      const nodes = pendingNodes.filter((n) => !n.hasAttribute('data-processed'));
      pendingNodes = [];
      renderScheduled = false;
      if (nodes.length > 0) {
        Promise.all(
          nodes.map(async (n) => {
            try {
              const specMermaid = n.closest('spec-mermaid') as HTMLElement & { _originalText?: string };
              const sourceText = specMermaid?._originalText || n.textContent || '';
              
              if (specMermaid && !specMermaid._originalText) {
                specMermaid._originalText = sourceText;
              }

              // Run normal initialization for first-time or just re-render directly
              // If we already have the text, we can do a targeted re-render
              const id = `mermaid-${crypto.randomUUID()}`;
              const { svg } = await mermaid.render(id, sourceText);
              n.innerHTML = svg;
              n.setAttribute('data-processed', 'true');
            } catch (err) {
              console.error('[solospec][mermaid] render failed:', err);
            }
          })
        );
      }
    });
  }
}

class SpecMermaid extends HTMLElement {
  private initialized = false;
  // Make original text accessible to the observer callback
  public _originalText?: string;

  connectedCallback() {
    if (this.initialized) return;
    this.initialized = true;

    const root = this.closest('.solospec-root') || document.querySelector('.solospec-root');
    
    // Resolve theme, mimicking runtime.tsx before it has a chance to set the effective attribute
    let themeMode: 'light' | 'dark' | undefined;
    const effectiveMode = root?.getAttribute('data-solospec-effective-mode');
    if (effectiveMode === 'light' || effectiveMode === 'dark') {
      themeMode = effectiveMode;
    }
    
    if (!themeMode) {
      try {
        const raw = window.localStorage.getItem('solospec.theme.preferences.v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.mode === 'light' || parsed.mode === 'dark') {
            themeMode = parsed.mode;
          }
        }
      } catch {
        // ignore
      }
    }

    if (!themeMode) {
      const mode = root?.getAttribute('data-solospec-mode');
      if (mode === 'light' || mode === 'dark') {
        themeMode = mode;
      }
    }

    if (!themeMode) {
      themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    const isDark = themeMode === 'dark';

    // Only initialize mermaid config globally once
    if (!Object.prototype.hasOwnProperty.call(window, '__specMermaidInitialized')) {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'strict',
      });
      (window as unknown as Record<string, unknown>).__specMermaidInitialized = true;
    }

    // Attempt to dynamically update mermaid theme if it was already initialized
    // but the theme doesn't match the current mode.
    // Mermaid initialize can be called multiple times to update config.
    const currentTheme = isDark ? 'dark' : 'default';
    if ((window as unknown as Record<string, unknown>).__specMermaidTheme !== currentTheme) {
      mermaid.initialize({ theme: currentTheme });
      (window as unknown as Record<string, unknown>).__specMermaidTheme = currentTheme;
    }

    const pre = this.querySelector('pre');
    if (pre) {
      // Save original text before initial render happens
      this._originalText = pre.textContent || '';
      scheduleRender(pre as HTMLElement);
      
      // Watch for theme changes on the root element
      if (root) {
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-solospec-effective-mode') {
              const newMode = (mutation.target as HTMLElement).getAttribute('data-solospec-effective-mode');
              const isDarkNow = newMode === 'dark';
              const newTheme = isDarkNow ? 'dark' : 'default';
              
              if ((window as unknown as Record<string, unknown>).__specMermaidTheme !== newTheme) {
                // Update global config
                mermaid.initialize({ theme: newTheme });
                (window as unknown as Record<string, unknown>).__specMermaidTheme = newTheme;
                
                // Clear the processed state and schedule a re-render
                pre.removeAttribute('data-processed');
                scheduleRender(pre as HTMLElement);
              }
            }
          }
        });
        
        observer.observe(root, { attributes: true, attributeFilter: ['data-solospec-effective-mode'] });
      }
    }
  }
}

if (!customElements.get('spec-mermaid')) {
  customElements.define('spec-mermaid', SpecMermaid);
}
