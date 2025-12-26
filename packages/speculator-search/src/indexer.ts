/**
 * Speculator Search - AST Indexer
 * 
 * Builds searchable indexes by traversing the AST and extracting text content.
 */

import type {
    Document,
    Section,
    Block,
    Inline,
    BlockParagraph,
    BlockHeading,
    InlineText,
    InlineDefinition,
} from '@openuji/speculator';

import type {
    SearchIndex,
    TermOccurrence,
    DocumentSearchMeta,
    SourceLocation,
} from './types.js';

import { tokenize, extractPhrases, extractContext, normalizeText } from './tokenizer.js';
import { sourcePosToLocation } from './types.js';

/**
 * Build search index from a document
 * 
 * @param document - Document to index
 * @returns Search index
 */
export function buildSearchIndex(document: Document): SearchIndex {
    const terms = new Map<string, TermOccurrence[]>();
    const phrases = new Map<string, TermOccurrence[]>();
    const documents = new Map<string, DocumentSearchMeta>();

    // Add document metadata
    const file = document.sourcePos?.file || 'unknown';
    documents.set(file, {
        file,
        title: document.metadata?.title,
        totalTerms: 0,
        totalPhrases: 0,
    });

    // Walk AST and build index
    const context = {
        sectionId: undefined as string | undefined,
        sectionTitle: undefined as string | undefined,
        headingPath: [] as string[],
    };

    walkDocument(document, terms, phrases, context);

    // Update metadata counts
    const meta = documents.get(file)!;
    meta.totalTerms = terms.size;
    meta.totalPhrases = phrases.size;

    return { terms, phrases, documents };
}

/**
 * Walk document and index content
 */
function walkDocument(
    document: Document,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    for (const child of document.children) {
        if (isSection(child)) {
            walkSection(child, terms, phrases, context);
        } else if (isBlock(child)) {
            walkBlock(child, terms, phrases, context);
        }
    }
}

/**
 * Walk section and index content
 */
function walkSection(
    section: Section,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    const prevSectionId = context.sectionId;
    const prevSectionTitle = context.sectionTitle;
    const prevHeadingPath = [...context.headingPath];

    // Update context with this section
    if (section.id) {
        context.sectionId = section.id;
    }

    // Index heading if present
    if (section.heading) {
        const headingText = extractInlineText(section.heading.children);
        if (headingText) {
            context.sectionTitle = headingText;
            context.headingPath.push(headingText);

            // Index heading text
            indexText(
                headingText,
                section.heading.sourcePos,
                'heading',
                section.heading.id,
                terms,
                phrases,
                context
            );
        }
    }

    // Walk children
    for (const child of section.children) {
        if (isSection(child)) {
            walkSection(child, terms, phrases, context);
        } else if (isBlock(child)) {
            walkBlock(child, terms, phrases, context);
        }
    }

    // Restore context
    context.sectionId = prevSectionId;
    context.sectionTitle = prevSectionTitle;
    context.headingPath = prevHeadingPath;
}

/**
 * Walk block and index content
 */
function walkBlock(
    block: Block,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    switch (block.type) {
        case 'paragraph':
            indexParagraph(block, terms, phrases, context);
            break;
        case 'heading':
            indexHeading(block, terms, phrases, context);
            break;
        case 'codeBlock':
            // Could index code blocks but skip for now
            break;
        case 'blockquote':
        case 'note':
        case 'example':
            // Index children
            for (const child of block.children) {
                walkBlock(child as Block, terms, phrases, context);
            }
            break;
        case 'list':
            // Index list items
            for (const item of block.children) {
                for (const child of item.children) {
                    walkBlock(child, terms, phrases, context);
                }
            }
            break;
        case 'table':
            // Index table cells
            for (const row of block.children) {
                for (const cell of row.children) {
                    const cellText = extractInlineText(cell.children);
                    if (cellText && cell.sourcePos) {
                        indexText(cellText, cell.sourcePos, 'tableCell', undefined, terms, phrases, context);
                    }
                }
            }
            break;
    }
}

/**
 * Index paragraph
 */
function indexParagraph(
    para: BlockParagraph,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    const text = extractInlineText(para.children);
    if (text && para.sourcePos) {
        indexText(text, para.sourcePos, 'paragraph', para.id, terms, phrases, context);
    }
}

/**
 * Index heading
 */
function indexHeading(
    heading: BlockHeading,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    const text = extractInlineText(heading.children);
    if (text && heading.sourcePos) {
        // Update heading path
        context.headingPath.push(text);
        context.sectionTitle = text;

        indexText(text, heading.sourcePos, 'heading', heading.id, terms, phrases, context);

        // Pop heading path after indexing
        context.headingPath.pop();
    }
}

/**
 * Index text content
 */
function indexText(
    text: string,
    sourcePos: any,
    nodeType: string,
    nodeId: string | undefined,
    terms: Map<string, TermOccurrence[]>,
    phrases: Map<string, TermOccurrence[]>,
    context: { sectionId?: string; sectionTitle?: string; headingPath: string[] }
): void {
    if (!sourcePos) return;

    const sourceLocation: SourceLocation = sourcePosToLocation(sourcePos);

    // Index individual terms
    const tokens = tokenize(text);
    for (const term of tokens) {
        const occurrence: TermOccurrence = {
            sourcePos: sourceLocation,
            nodeType,
            nodeId,
            term,
            context: extractContext(text, text.indexOf(term), term.length, 50),
            fullText: text,
            sectionId: context.sectionId,
            sectionTitle: context.sectionTitle,
            headingPath: [...context.headingPath],
        };

        if (!terms.has(term)) {
            terms.set(term, []);
        }
        terms.get(term)!.push(occurrence);
    }

    // Index phrases (2-3 words)
    const extractedPhrases = extractPhrases(text);
    for (const phrase of extractedPhrases) {
        const occurrence: TermOccurrence = {
            sourcePos: sourceLocation,
            nodeType,
            nodeId,
            term: phrase,
            context: extractContext(text, text.toLowerCase().indexOf(phrase), phrase.length, 50),
            fullText: text,
            sectionId: context.sectionId,
            sectionTitle: context.sectionTitle,
            headingPath: [...context.headingPath],
        };

        if (!phrases.has(phrase)) {
            phrases.set(phrase, []);
        }
        phrases.get(phrase)!.push(occurrence);
    }
}

/**
 * Extract text from inline nodes
 */
function extractInlineText(inlines: Inline[]): string {
    let text = '';

    for (const inline of inlines) {
        switch (inline.type) {
            case 'text':
                text += inline.value;
                break;
            case 'inlineCode':
                text += inline.value;
                break;
            case 'emphasis':
            case 'strong':
            case 'link':
                text += extractInlineText(inline.children);
                break;
            case 'definition':
                text += extractInlineText(inline.children);
                break;
            case 'reference':
                text += extractInlineText(inline.children);
                break;
            case 'cite':
                text += inline.key;
                break;
        }
    }

    return text;
}

/**
 * Type guard for Section
 */
function isSection(node: unknown): node is Section {
    return typeof node === 'object' && node !== null && (node as any).type === 'section';
}

/**
 * Type guard for Block
 */
function isBlock(node: unknown): node is Block {
    if (typeof node !== 'object' || node === null) return false;
    const type = (node as any).type;
    return [
        'paragraph',
        'heading',
        'codeBlock',
        'example',
        'blockquote',
        'list',
        'table',
        'thematicBreak',
        'html',
        'note',
    ].includes(type);
}
