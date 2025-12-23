import nunjucks from 'nunjucks';
import type { VocabSource, TermDefinition } from '../model.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface HTMLOptions {
    mode: 'ED' | 'TR';
    version?: string;
    baseUrl?: string;
}

/**
 * Generate HTML vocabulary page
 */
export function generateHTML(source: VocabSource, options: HTMLOptions): string {
    // Configure Nunjucks to load templates from the templates directory
    const templatesDir = join(__dirname, '..', 'templates');
    const env = nunjucks.configure(templatesDir, {
        autoescape: true,
        trimBlocks: true,
        lstripBlocks: true,
    });

    // Group terms by kind
    const classes = source.terms.filter((t: TermDefinition) => t.kind === 'Class').sort((a: TermDefinition, b: TermDefinition) => a.id.localeCompare(b.id));
    const properties = source.terms.filter((t: TermDefinition) => t.kind === 'Property').sort((a: TermDefinition, b: TermDefinition) => a.id.localeCompare(b.id));

    // Prepare template data
    const templateData = {
        title: source.title,
        description: source.description,
        namespace: source.namespace,
        docBase: source.docBase,
        module: source.module,
        status: source.status,
        mode: options.mode,
        version: options.version || source.version,
        updated: source.updated,
        classes,
        properties,
        baseUrl: options.baseUrl || '',
    };

    return env.render('vocab.html', templateData);
}
