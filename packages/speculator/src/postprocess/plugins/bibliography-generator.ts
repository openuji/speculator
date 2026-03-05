/**
 * Bibliography Generator Plugin
 * 
 * Generates "Normative References" and "Informative References" sections
 * based on collected citations and bibliography data.
 */

import type { Plugin, ComputeContext } from '#src/pipeline/types';
import type { Section, BlockHtml, IndexBiblioEntry, Block, Inline } from '#src/types/ast.generated';

function generateBiblioHtml(entry: IndexBiblioEntry): string {
    const authors = entry.authors?.map(a => `<span class="person-name">${a}</span>`).join(', ') || '';
    const date = entry.date ? `, ${entry.date}` : '';
    const status = entry.status ? `, ${entry.status}` : '';
    const publisher = entry.publisher ? `. ${entry.publisher}` : '';
    
    // Construct the DD content
    let ddContent = '';
    if (entry.title) {
        ddContent += `<cite><a href="${entry.url || '#'}">${entry.title}</a></cite>`;
    }
    if (authors) {
        ddContent += `. ${authors}`;
    }
    ddContent += date;
    ddContent += status;
    ddContent += publisher;
    ddContent += '.';
    if (entry.url) {
        ddContent += ` <a href="${entry.url}" class="bib-url">${entry.url}</a>`;
    }

    // Use raw fallback if available and we didn't build much
    if (entry.raw && !entry.title) {
        ddContent = entry.raw;
    }

    return `<dt id="bib-${entry.key}">[${entry.key}]</dt><dd>${ddContent}</dd>`;
}

function createReferenceSection(title: string, id: string, citations: string[], biblioMap: Map<string, IndexBiblioEntry>): Section | null {
    if (citations.length === 0) return null;

    const dlContent = citations.map(key => {
        
        const entry = biblioMap.get(key.toUpperCase()) || { key, title: key, url: '' }; // Fallback
        return generateBiblioHtml(entry);
    }).join('\n');

    return {
        type: 'section',
        id,
        heading: {
            type: 'heading',
            depth: 3,
            children: [{ type: 'text', value: title }]
        },
        children: [
            {
                type: 'html',
                value: `<dl class="bibliography">${dlContent}</dl>`,
                children: [],
            } as BlockHtml
        ]
    };
}

export const bibliographyGeneratorPlugin: Plugin = {
    name: 'bibliography-generator',
    order: { compute: 5 }, // Before TOC

    async compute(ctx: ComputeContext): Promise<void> {
        const { workspace, document } = ctx;

        if (!workspace || !workspace.globalIndex?.bibliography) return;

        // 1. Identify citations relevant to this document
        const docCitations = document.indexes?.citations || [];
        if (docCitations.length === 0) return;

        // 2. Resolve entries
        const biblioMap = new Map<string, IndexBiblioEntry>();
        workspace.globalIndex.bibliography.forEach(entry => biblioMap.set(entry.key.toUpperCase(), entry));

        // 3. Group by kind
        const normativeKeys = new Set<string>();
        const informativeKeys = new Set<string>();

        docCitations.forEach(cite => {
            if (cite.kind === 'normative') {
                normativeKeys.add(cite.key);
                informativeKeys.delete(cite.key); // Normative wins if mixed? Usually yes.
            } else {
                if (!normativeKeys.has(cite.key)) {
                    informativeKeys.add(cite.key);
                }
            }
        });

        // Ensure RFC2199/RFC8174 are treated as normative if they were injected
        // (They might be in docCitations if index ran after transform)
        
        const normativeSection = createReferenceSection(
            'Normative References', 
            'bibliography-generator-normative-references', 
            Array.from(normativeKeys).sort(), 
            biblioMap
        );
        
        const informativeSection = createReferenceSection(
            'Informative References', 
            'bibliography-generator-informative-references', 
            Array.from(informativeKeys).sort(), 
            biblioMap
        );

        if (!normativeSection && !informativeSection) return;

        // 4. Create wrapper section
        const wrapperSection: Section = {
            type: 'section',
            noTocCount: true,
            id: 'references',
            heading: {
                type: 'heading',
                depth: 2,
                children: [{ type: 'text', value: 'References' }]
            },
            children: []
        };
        
        if (normativeSection) wrapperSection.children.push(normativeSection);
        if (informativeSection) wrapperSection.children.push(informativeSection);

        // 5. Find the <spec-biblio-references /> tag and replace it
        function replaceInContainer(children: Array<Section | Block | Inline>): boolean {
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if ((child.type === 'htmlElement' || child.type === 'htmlInlineElement') && 
                    ((child as { tagName?: string }).tagName || '').toLowerCase() === 'spec-biblio-references') {
                    children.splice(i, 1, wrapperSection as Section);
                    return true;
                }
                const childWithChildren = child as { children?: Array<Section | Block | Inline> };
                if (childWithChildren.children && Array.isArray(childWithChildren.children)) {
                    if (replaceInContainer(childWithChildren.children)) {
                        return true;
                    }
                }
            }
            return false;
        }

        replaceInContainer(document.children as Section[]);
    }
};
