import { createHighlighter } from 'shiki';
import type { Document, Block, Section, Inline } from '@openuji/speculator';

// We want to attach the highlighted HTML to the code block node directly.
// Normally we shouldn't mutate the AST but since we are doing a pre-render pass,
// we can inject this non-standard field for the renderer to pick up.
export interface HighlightedCodeBlock {
  highlightedHtml?: string;
}

/**
 * Recursively find all code block nodes in the document AST.
 */
function walkForCodeBlocks(node: Document | Section | Block | Inline, codeBlocks: Block[]): void {
  if (node.type === 'codeBlock') {
    codeBlocks.push(node as Block);
  }

  if ('children' in node && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkForCodeBlocks(child as Document | Section | Block | Inline, codeBlocks);
    }
  }
}

/**
 * Pre-processes the document AST to highlight all code blocks.
 * It dynamically extracts the used languages and only initializes
 * Shiki with those exact languages to minimize bundle size / loading time.
 */
export async function highlightDocument(document: Document): Promise<void> {
  const codeBlocks: Block[] = [];
  walkForCodeBlocks(document, codeBlocks);

  if (codeBlocks.length === 0) {
    return;
  }

  const langsToLoad = new Set<string>();
  for (const block of codeBlocks as (Block & { lang?: string })[]) {
    if (block.lang && block.lang !== 'mermaid') {
      langsToLoad.add(block.lang);
    }
  }

  if (langsToLoad.size === 0) {
    return;
  }

  try {
    // Create highlighter with just the themes first, no languages
    const highlighter = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [],
    });

    // Try loading each language individually so unsupported ones
    // (e.g. jsonld, sparql) are skipped gracefully instead of
    // failing the entire highlighter initialization.
    const loadedLangs = new Set<string>();
    for (const lang of langsToLoad) {
      try {
        await highlighter.loadLanguage(lang as import('shiki').BundledLanguage);
        loadedLangs.add(lang);
      } catch {
        console.info(`[solospec:shiki] Language '${lang}' not available in Shiki, skipping highlighting.`);
      }
    }

    // highlighter.dispose();

    for (const block of codeBlocks as (Block & { lang?: string, value: string, highlightedHtml?: string })[]) {
      if (!block.lang || block.lang === 'mermaid') continue;
      if (!loadedLangs.has(block.lang)) continue;

      try {
        const html = highlighter.codeToHtml(block.value, {
          lang: block.lang,
          themes: {
            light: 'github-light',
            dark: 'github-dark',
          },
          defaultColor: false,
        });
        
        // Mutate the AST node directly to attach the highlighted HTML
        block.highlightedHtml = html;

      } catch (err) {
        // If a specific language highlighting fails, we let it fallback to plain text rendering
        console.warn(`[solospec:shiki] Failed to highlight block with language '${block.lang}':`, err);
      }
    }
  } catch (err) {
    console.error(`[solospec:shiki] Failed to initialize Shiki highlighter:`, err);
  }
}
