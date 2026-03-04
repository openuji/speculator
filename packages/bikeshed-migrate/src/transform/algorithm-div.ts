/**
 * Transform <div algorithm="x"> and <div algorithm> to <section data-algorithm="x">.
 *
 * Bikeshed uses <div algorithm> to mark algorithm blocks. Speculator uses
 * <section data-algorithm> (following the WHATWG pattern). We rename the element
 * so downstream parsers can handle it correctly.
 */

import type { Element } from 'hast';

/**
 * Mutate a <div algorithm> element in-place to <section data-algorithm>.
 * Returns true if a transformation was applied, false otherwise.
 */
export function tryAlgorithmDiv(node: Element): boolean {
    if (node.tagName.toLowerCase() !== 'div') return false;

    const props = node.properties ?? {};

    // Check for algorithm attribute (boolean or valued)
    // hast represents <div algorithm> as { algorithm: true } or { algorithm: '' }
    // and <div algorithm="x"> as { algorithm: 'x' }
    if (!('algorithm' in props)) return false;

    const algorithmValue = props.algorithm;
    const dataAlgorithmValue =
        algorithmValue === true || algorithmValue === ''
            ? ''
            : String(algorithmValue);

    // Rename to section and set data-algorithm
    node.tagName = 'section';
    delete node.properties!.algorithm;
    node.properties = {
        ...node.properties,
        dataAlgorithm: dataAlgorithmValue,
    };

    return true;
}
