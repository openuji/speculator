import nunjucks from 'nunjucks';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import type { Workspace, Document } from '@openuji/speculator';
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
        default:
            return renderChildren(node);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderSection(node: any): string {
    const id = node.id ? ` id="${escapeHtml(node.id)}"` : '';
    const className = node.data?.respecClass ? ` class="${escapeHtml(node.data.respecClass)}"` : '';
    const title = node.title ? `<h${node.level || 2}>${escapeHtml(node.title)}</h${node.level || 2}>` : '';
    const content = renderChildren(node);

    return `<section${id}${className}>\n${title}\n${content}\n</section>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderParagraph(node: any): string {
    return `<p>${renderChildren(node)}</p>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderHeading(node: any): string {
    const level = node.level || 2;
    return `<h${level}>${renderChildren(node)}</h${level}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderDefinition(node: any): string {
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
function renderList(node: any): string {
    const tag = node.ordered ? 'ol' : 'ul';
    const content = renderChildren(node);
    return `<${tag}>${content}</${tag}>`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderChildren(node: any): string {
    if (!node.children || !Array.isArray(node.children)) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return node.children.map((child: any) => renderNode(child)).join('');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
