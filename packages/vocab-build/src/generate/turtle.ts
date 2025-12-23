import { Writer, DataFactory } from 'n3';
import type { VocabSource } from '../model.js';

const { namedNode, literal } = DataFactory;

export interface TurtleOptions {
    mode: 'ED' | 'TR';
    version?: string;
}

/**
 * Generate Turtle/RDF vocabulary from source
 */
export function generateTurtle(source: VocabSource, options: TurtleOptions): string {
    const writer = new Writer({
        prefixes: {
            rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
            rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
            owl: 'http://www.w3.org/2002/07/owl#',
            xsd: 'http://www.w3.org/2001/XMLSchema#',
            '': source.namespace,
        },
    });

    // Add ontology header
    const ontologyIRI = source.docBase;
    writer.addQuad(
        namedNode(ontologyIRI),
        namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        namedNode('http://www.w3.org/2002/07/owl#Ontology')
    );

    writer.addQuad(
        namedNode(ontologyIRI),
        namedNode('http://www.w3.org/2000/01/rdf-schema#label'),
        literal(source.title)
    );

    writer.addQuad(
        namedNode(ontologyIRI),
        namedNode('http://www.w3.org/2000/01/rdf-schema#comment'),
        literal(source.description)
    );

    // Add version metadata for TR
    if (options.mode === 'TR' && options.version) {
        writer.addQuad(
            namedNode(ontologyIRI),
            namedNode('http://www.w3.org/2002/07/owl#versionInfo'),
            literal(options.version)
        );

        const versionIRI = `${ontologyIRI}/TR/${source.module}/${options.version}/vocab.ttl`;
        writer.addQuad(
            namedNode(ontologyIRI),
            namedNode('http://www.w3.org/2002/07/owl#versionIRI'),
            namedNode(versionIRI)
        );
    }

    // Add imports for UI module (imports core)
    if (source.module === 'ui') {
        writer.addQuad(
            namedNode(ontologyIRI),
            namedNode('http://www.w3.org/2002/07/owl#imports'),
            namedNode('https://ujm.specs.openuji.org/ns')
        );
    }

    // Add terms
    for (const term of source.terms) {
        const termIRI = `${source.namespace}${term.id}`;
        const termType =
            term.kind === 'Class'
                ? 'http://www.w3.org/2000/01/rdf-schema#Class'
                : 'http://www.w3.org/1999/02/22-rdf-syntax-ns#Property';

        writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), namedNode(termType));

        writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/2000/01/rdf-schema#label'), literal(term.label));

        writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/2000/01/rdf-schema#comment'), literal(term.comment));

        // Add domain and range if present
        if (term.domain) {
            writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/2000/01/rdf-schema#domain'), namedNode(term.domain));
        }

        if (term.range) {
            writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/2000/01/rdf-schema#range'), namedNode(term.range));
        }

        // Add deprecated marker
        if (term.deprecated) {
            writer.addQuad(
                namedNode(termIRI),
                namedNode('http://www.w3.org/2002/07/owl#deprecated'),
                literal('true', namedNode('http://www.w3.org/2001/XMLSchema#boolean'))
            );
        }

        // Add seeAlso links
        if (term.seeAlso) {
            for (const url of term.seeAlso) {
                writer.addQuad(namedNode(termIRI), namedNode('http://www.w3.org/2000/01/rdf-schema#seeAlso'), namedNode(url));
            }
        }
    }

    let result = '';
    writer.end((error: Error | null, output: string) => {
        if (error) throw error;
        result = output;
    });

    return result;
}
