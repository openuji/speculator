/**
 * Document Assembler
 * 
 * Assembles parsed blocks from multiple units into a document with
 * proper section hierarchy based on heading levels.
 */

import type {
    Section,
    Block,
    BlockHeading,
    Document,
    DocumentMetadata,
} from '#src/types/ast.generated';

import type { SpecConfig } from '#src/preprocess/types';

/**
 * Check if node is a heading block
 */
function isHeading(node: Section | Block): node is BlockHeading {
    return node.type === 'heading';
}

/**
 * Check if node is already a section
 */
function isSection(node: Section | Block): node is Section {
    return node.type === 'section';
}

/**
 * Create section from heading
 */
function createSectionFromHeading(heading: BlockHeading): Section {
    const section: Section = {
        type: 'section',
        heading: {
            type: 'heading',
            depth: heading.depth,
            children: heading.children,
        },
        children: [],
    };

    if (heading.id) {
        section.id = heading.id;
        section.heading!.id = heading.id;
    }
    if (heading.sourcePos) {
        section.sourcePos = heading.sourcePos;
        section.heading!.sourcePos = heading.sourcePos;
    }
    if (heading.noToc) {
        section.noToc = true;
        section.heading!.noToc = true;
    }
    if (heading.dataCopConcept) {
        section.dataCopConcept = heading.dataCopConcept;
        section.heading!.dataCopConcept = heading.dataCopConcept;
    }

    return section;
}

/**
 * Build section hierarchy from flat blocks
 * 
 * Converts headings to sections and nests content based on heading depth.
 * Pre-existing sections (from HTML) are inserted at their natural position.
 */
export function buildSectionHierarchy(blocks: (Section | Block)[]): (Section | Block)[] {
    if (blocks.length === 0) return [];

    const result: (Section | Block)[] = [];

    // Stack of (section, depth) for tracking hierarchy
    // depth 0 means top-level content before any heading
    const sectionStack: Array<{ section: Section | null; depth: number }> = [
        { section: null, depth: 0 }
    ];

    /**
     * Get current container for adding content
     */
    function getCurrentContainer(): (Section | Block)[] {
        const top = sectionStack[sectionStack.length - 1];
        if (top.section) {
            return top.section.children;
        }
        return result;
    }

    /**
     * Pop sections until we find one with depth < targetDepth
     */
    function popToDepth(targetDepth: number): void {
        while (sectionStack.length > 1) {
            const top = sectionStack[sectionStack.length - 1];
            if (top.depth < targetDepth) break;
            sectionStack.pop();
        }
    }

    for (const node of blocks) {
        if (isSection(node)) {
            // Pre-existing section - determine its depth from heading or default to 1
            const sectionDepth = node.heading?.depth ?? 1;

            // Pop to appropriate level
            popToDepth(sectionDepth);

            // Add to current container
            getCurrentContainer().push(node);

            // Push this section onto stack
            sectionStack.push({ section: node, depth: sectionDepth });
        } else if (isHeading(node)) {
            const headingDepth = node.depth;

            // Pop sections until we find parent level
            popToDepth(headingDepth);

            // Create new section from heading
            const newSection = createSectionFromHeading(node);

            // Add to current container
            getCurrentContainer().push(newSection);

            // Push new section onto stack
            sectionStack.push({ section: newSection, depth: headingDepth });
        } else {
            // Regular block - add to current container
            getCurrentContainer().push(node);
        }
    }

    return result;
}

/**
 * Convert SpecConfig to DocumentMetadata
 */
function configToMetadata(config: SpecConfig): DocumentMetadata | undefined {
    const meta: DocumentMetadata = {};
    let hasContent = false;

    if (config.title) {
        meta.title = config.title;
        hasContent = true;
    }
    if (config.subtitle) {
        meta.subtitle = config.subtitle;
        hasContent = true;
    }
    if (config.shortName) {
        meta.shortName = config.shortName;
        hasContent = true;
    }
    if (config.status) {
        meta.status = config.status;
        hasContent = true;
    }
    if (config.maturityLevel) {
        meta.maturityLevel = config.maturityLevel;
        hasContent = true;
    }
    if (config.version) {
        meta.version = config.version;
        hasContent = true;
    }
    if (config.deps && config.deps.length > 0) {
        meta.deps = config.deps;
        hasContent = true;
    }
    if (config.publishDate) {
        meta.publishDate = config.publishDate;
        hasContent = true;
    }
    if (config.lastUpdateDate) {
        meta.lastUpdateDate = config.lastUpdateDate;
        hasContent = true;
    }
    if (config.editors && config.editors.length > 0) {
        meta.editors = config.editors.map(e => ({
            name: e.name,
            url: e.url,
            company: e.company,
            note: e.note,
            w3cid: e.w3cid,
        }));
        hasContent = true;
    }
    if (config.authors && config.authors.length > 0) {
        meta.authors = config.authors.map(a => ({
            name: a.name,
            url: a.url,
            company: a.company,
            note: a.note,
            w3cid: a.w3cid,
        }));
        hasContent = true;
    }
    if (config.abstract) {
        meta.abstract = config.abstract;
        hasContent = true;
    }
    if (config.repository) {
        meta.repository = typeof config.repository === 'string'
            ? config.repository
            : {
                url: config.repository.url,
                branch: config.repository.branch,
                repoType: config.repository.type,
            };
        hasContent = true;
    }
    if (config.group) {
        meta.group = typeof config.group === 'string'
            ? config.group
            : {
                name: config.group.name,
                url: config.group.url,
            };
        hasContent = true;
    }
    if (config.copyright) {
        meta.copyright = config.copyright;
        hasContent = true;
    }
    if (config.license) {
        meta.license = config.license;
        hasContent = true;
    }
    if (config.logos) {
        meta.logos = config.logos;
        hasContent = true;
    }
    if (config.custom) {
        meta.custom = config.custom;
        hasContent = true;
    }
    if (config.noConformance) {
        meta.noConformance = config.noConformance;
        hasContent = true;
    }

    return hasContent ? meta : undefined;
}

/**
 * Assemble blocks into a complete document
 */
export function assembleDocument(
    blocks: (Section | Block)[],
    config: SpecConfig,
    entryFile: string
): Document {
    // Build section hierarchy
    const children = buildSectionHierarchy(blocks);

    // Create document
    const doc: Document = {
        type: 'document',
        id: config.id,
        children,
    };

    // Add metadata from config
    const metadata = configToMetadata(config);
    if (metadata) {
        doc.metadata = metadata;
    }



    // Add sourcePos for document root
    doc.sourcePos = {
        file: entryFile,
        line: 1,
        column: 1,
    };

    return doc;
}
