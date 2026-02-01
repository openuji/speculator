import nunjucks from 'nunjucks';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { 
    Workspace, Document, Section, Block, Inline,
    BlockParagraph, BlockSpecStatement, BlockHeading,
    InlineDefinition, BlockList, ListItem 
} from '@openuji/speculator';
import type { LintResult } from '@openuji/speculator-lint';
import type { ReSpecConfig } from '../model.js';
import { generateToc, renderTocHtml } from './toc.js';
import { renderDiagnosticsHtml } from './diagnostics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generate complete ReSpec HTML document
 */
export async function generateHTML(
    workspace: Workspace,
    config: ReSpecConfig,
    lintResult: LintResult
): Promise<string> {
    // Get the entry document (first document in workspace)
    const document = workspace.documents[0];
    if (!document) {
        throw new Error('No document found in workspace');
    }

    // Generate TOC
    const tocEntries = generateToc(document, config.maxTocLevel);
    const tocHtml = renderTocHtml(tocEntries);

    // Render main content from AST
    const contentHtml = renderDocumentContent(document);

    // Render diagnostics
    const diagnosticsHtml = renderDiagnosticsHtml(lintResult);

    // Prepare template data
    const templateData = {
        // Document metadata
        title: document.metadata?.title || 'Specification',
        subtitle: config.subtitle,

        // Status and dates
        specStatus: config.specStatus,
        publishDate: config.publishDate || new Date().toISOString().split('T')[0],
        previousPublishDate: config.previousPublishDate,

        // People
        editors: config.editors || [],
        authors: config.authors || [],

        // Organization
        group: config.group,
        wg: config.wg,
        wgURI: config.wgURI,

        // Content
        abstract: extractAbstract(document),
        toc: tocHtml,
        content: contentHtml,
        diagnostics: diagnosticsHtml,

        // GitHub
        github: config.github,

        // Copyright
        copyrightStart: config.copyrightStart || new Date().getFullYear().toString(),

        // Logos
        logos: config.logos || [],
        
        // JSON-LD
        jsonLd: buildJsonLd(workspace, document, config),
    };

    // Configure Nunjucks
    const templatesDir = join(__dirname, '..', 'templates');
    nunjucks.configure(templatesDir, { autoescape: false });

    // Render template
    const html = nunjucks.render('respec.html', templateData);

    return html;
}

/**
 * Extract abstract section from document
 */
function extractAbstract(document: Document): string {
    if (!document.children) return 'No abstract provided.';

    for (const child of document.children) {
        if (child.type === 'section') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const section = child as any;
            if (section.id === 'abstract' || section.data?.respecClass === 'abstract') {
                return renderNode(section);
            }
        }
    }

    return 'No abstract provided.';
}

/**
 * Render document content as HTML
 */
function renderDocumentContent(document: Document): string {
    if (!document.children) return '';

    return document.children
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((child: any) => child.id !== 'abstract') // Skip abstract, it's rendered separately
        .map(child => renderNode(child))
        .join('\n');
}

/**
 * Recursively render an AST node to HTML
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderNode(node: any): string {
    if (!node || typeof node !== 'object') return '';

    switch (node.type) {
        case 'section':
            return renderSection(node);
        case 'paragraph':
            return renderParagraph(node);
        case 'heading':
            return renderHeading(node);
        case 'text':
            return escapeHtml(node.value || '');
        case 'definition':
            return renderDefinition(node);
        case 'reference':
            return renderReference(node);
        case 'code':
            return `<code>${escapeHtml(node.value || '')}</code>`;
        case 'emphasis':
            return `<em>${renderChildren(node)}</em>`;
        case 'strong':
            return `<strong>${renderChildren(node)}</strong>`;
        case 'link':
            return `<a href="${escapeHtml(node.href || '#')}">${renderChildren(node)}</a>`;
        case 'list':
            return renderList(node);
        case 'listItem':
            return `<li>${renderChildren(node)}</li>`;
        case 'specStatement':
            return renderSpecStatement(node);
        default:
            return renderChildren(node);
    }
}

function renderSection(node: Section): string {
    const id = node.id ? ` id="${escapeHtml(node.id)}"` : '';
    
    // Some sections might have custom classes added by the assembler/transformer
    const data = (node as { data?: Record<string, unknown> }).data;
    const respecClass = data?.respecClass;
    const className = typeof respecClass === 'string' ? ` class="${escapeHtml(respecClass)}"` : '';
    
    let title = '';
    if (node.heading) {
        const depth = node.heading.depth;
        title = `<h${depth}>${renderChildren(node.heading)}</h${depth}>`;
    }
    
    const content = renderChildren(node);

    return `<section${id}${className}>\n${title}\n${content}\n</section>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderParagraph(node: BlockParagraph): string {
    return `<p>${renderChildren(node)}</p>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSpecStatement(node: BlockSpecStatement): string {
    const id = '';
    const levelClass = node.level ? ` ${node.level.toLowerCase().replace(/\s+/g, '-')}` : '';
    
    return `<p${id} class="spec-statement${levelClass}">${renderChildren(node)}</p>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderHeading(node: BlockHeading): string {
    const level = node.depth || 2;
    return `<h${level}>${renderChildren(node)}</h${level}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDefinition(node: InlineDefinition): string {
    const term = node.term || renderChildren(node);
    const id = node.id ? ` id="${escapeHtml(node.id)}"` : '';
    return `<dfn${id}>${escapeHtml(term)}</dfn>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderReference(node: any): string {
    const targetTerm = node.targetTerm || renderChildren(node);
    const href = node.resolved?.id ? `#${escapeHtml(node.resolved.id)}` : '#';
    return `<a href="${href}" class="internalDFN">${escapeHtml(targetTerm)}</a>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderList(node: BlockList): string {
    const tag = node.ordered ? 'ol' : 'ul';
    const content = renderChildren(node);
    return `<${tag}>${content}</${tag}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChildren(node: any): string {
    const children = (node as { children?: (Section | Block | Inline | ListItem)[] }).children;
    if (!children || !Array.isArray(children)) return '';
    return children.map((child) => renderNode(child)).join('');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Build JSON-LD script tag
 */
function buildJsonLd(_workspace: Workspace, document: Document, _config: ReSpecConfig): string {
    const statementsJsonLd = document.computed?.statementsJsonLd;
    if (!statementsJsonLd) {
        return '';
    }

    return `<script type="application/ld+json">\n${JSON.stringify(statementsJsonLd, null, 2)}\n</script>`;
}
