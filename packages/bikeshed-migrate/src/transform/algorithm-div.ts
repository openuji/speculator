/**
 * Transform <div algorithm="x"> and <div algorithm> to <div data-algorithm="x">.
 *
 * Bikeshed uses <div algorithm> to mark algorithm blocks. Speculator uses
 * <div data-algorithm>. We rename the attribute and keep the element as a div.
 */

import type { Element } from 'hast';

/**
 * Mutate a <div algorithm> element in-place to <div data-algorithm>.
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
    // Use boolean true for a valueless attribute (renders as data-algorithm, not data-algorithm="")
    const dataAlgorithmValue =
        algorithmValue === true || algorithmValue === ''
            ? true
            : String(algorithmValue);

    delete node.properties!.algorithm;
    node.properties = {
        ...node.properties,
        dataAlgorithm: dataAlgorithmValue,
    };

    return true;
}
