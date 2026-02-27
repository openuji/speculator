import { createHighlighter, type LanguageRegistration, type BundledLanguage } from 'shiki';
import type { Document, Block, Section, Inline } from '@openuji/speculator';
import jsonLDLanguage from '../grammar/jsonld.tmLanguage.json' with { type: 'json' };
import type { CodeHighlightThemeSettings } from '../theme/config.js';

// We want to attach the highlighted HTML to the code block node directly.
// Normally we shouldn't mutate the AST but since we are doing a pre-render pass,
// we can inject this non-standard field for the renderer to pick up.
// Probably we should enhance as AST node type to include this field.
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

const UNSUPPORTED_LANGUAGES = new Set(['mermaid']);


type HighlighterInstance = Awaited<ReturnType<typeof createHighlighter>>;

/**
 * Checks if a language should be processed by the syntax highlighter.
 */
function isHighlightable(lang?: string): lang is string {
  return !!lang && !UNSUPPORTED_LANGUAGES.has(lang);
}

/**
 * Extracts all target languages from the provided code blocks that should be loaded.
 */
function extractLanguagesToLoad(codeBlocks: Block[]): Set<string> {
  const langsToLoad = new Set<string>();
  for (const block of codeBlocks as (Block & { lang?: string })[]) {
    if (isHighlightable(block.lang)) {
      langsToLoad.add(block.lang);
    }
  }
  return langsToLoad;
}

let globalHighlighter: HighlighterInstance | null = null;
const globalLoadedLangs = new Set<string>();

/**
 * Loads the required languages into the Shiki highlighter instance.
 * Handles special custom languages gracefully alongside Shiki bundled languages.
 */
async function loadLanguages(highlighter: HighlighterInstance, langsToLoad: Set<string>): Promise<Set<string>> {
  for (const lang of langsToLoad) {
    if (globalLoadedLangs.has(lang)) continue;

    try {
      if (lang === 'jsonld') {
        await highlighter.loadLanguage(jsonLDLanguage as unknown as LanguageRegistration);
      } else {
        await highlighter.loadLanguage(lang as BundledLanguage); // bundled language id
      }
      globalLoadedLangs.add(lang);
    } catch {
      console.info(`[solospec:shiki] Language '${lang}' not available, skipping.`);
      // Add to loaded set to prevent retrying unsupported languages repeatedly
      globalLoadedLangs.add(lang);
    }
  }
  return globalLoadedLangs;
}

/**
 * Applies syntax highlighting HTML to each valid, loaded code block dynamically.
 */
function applyHighlightingToBlocks(highlighter: HighlighterInstance, codeBlocks: Block[], loadedLangs: Set<string>, codeHighlightTheme: CodeHighlightThemeSettings): void {
  for (const block of codeBlocks as (Block & { lang?: string, value: string, highlightedHtml?: string })[]) {
    if (!isHighlightable(block.lang) || !loadedLangs.has(block.lang)) {
      continue;
    }

    try {
      block.highlightedHtml = highlighter.codeToHtml(block.value, {
        lang: block.lang,
        themes: {
          light: codeHighlightTheme.light,
          dark: codeHighlightTheme.dark,
        },
        defaultColor: false,
      });
    } catch (err) {
      console.warn(`[solospec:shiki] Failed to highlight block with language '${block.lang}':`, err);
    }
  }
}

/**
 * Pre-processes the document AST to highlight all code blocks.
 * It dynamically extracts the used languages and only initializes
 * Shiki with those exact languages to minimize bundle size / loading time.
 */
export async function highlightDocument(document: Document, codeHighlightTheme: CodeHighlightThemeSettings): Promise<void> {
  const codeBlocks: Block[] = [];
  walkForCodeBlocks(document, codeBlocks);

  if (codeBlocks.length === 0) {
    return;
  }

  const langsToLoad = extractLanguagesToLoad(codeBlocks);
  if (langsToLoad.size === 0) {
    return;
  }

  try {
    if (!globalHighlighter) {
      // Create global highlighter instance with themes, no initial languages
      globalHighlighter = await createHighlighter({
        themes: Object.values(codeHighlightTheme),
        langs: [],
      });
    }

    const loadedLangs = await loadLanguages(globalHighlighter, langsToLoad);
    applyHighlightingToBlocks(globalHighlighter, codeBlocks, loadedLangs, codeHighlightTheme);
  } catch (err) {
    console.error(`[solospec:shiki] Failed to initialize Shiki highlighter:`, err);
  }
}
