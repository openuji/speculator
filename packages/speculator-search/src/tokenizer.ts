/**
 * Speculator Search - Text Tokenization
 * 
 * Utilities for tokenizing and normalizing text for search indexing.
 */

/**
 * Tokenize text into normalized terms
 * 
 * @param text - Text to tokenize
 * @returns Array of normalized terms
 */
export function tokenize(text: string): string[] {
    // Split on word boundaries, keeping only alphanumeric sequences
    const tokens = text.match(/\b[\w'-]+\b/g) || [];

    // Normalize each token
    return tokens.map(normalizeText).filter(t => t.length > 0);
}

/**
 * Normalize text for search (lowercase, trim)
 * 
 * @param text - Text to normalize
 * @returns Normalized text
 */
export function normalizeText(text: string): string {
    return text.toLowerCase().trim();
}

/**
 * Extract n-word phrases from text
 * 
 * @param text - Text to extract phrases from
 * @param maxWords - Maximum words per phrase (default: 3)
 * @returns Array of phrase strings
 */
export function extractPhrases(text: string, maxWords: number = 3): string[] {
    const tokens = tokenize(text);
    const phrases: string[] = [];

    // Extract 2-word and 3-word phrases
    for (let n = 2; n <= Math.min(maxWords, 3); n++) {
        for (let i = 0; i <= tokens.length - n; i++) {
            const phrase = tokens.slice(i, i + n).join(' ');
            phrases.push(phrase);
        }
    }

    return phrases;
}

/**
 * Check if a term is a stop word
 * 
 * Common words that are typically excluded from search indexes.
 * For now, we don't filter stop words but this is available for future use.
 * 
 * @param term - Term to check
 * @returns True if term is a stop word
 */
export function isStopWord(term: string): boolean {
    const stopWords = new Set([
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
        'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
        'that', 'the', 'to', 'was', 'will', 'with'
    ]);

    return stopWords.has(normalizeText(term));
}

/**
 * Extract context around a match position
 * 
 * @param text - Full text
 * @param matchStart - Start position of match
 * @param matchLength - Length of the match
 * @param contextLength - Number of characters of context (default: 50 on each side)
 * @returns Context string with match highlighted
 */
export function extractContext(
    text: string,
    matchStart: number,
    matchLength: number,
    contextLength: number = 50
): string {
    const before = Math.max(0, matchStart - contextLength);
    const after = Math.min(text.length, matchStart + matchLength + contextLength);

    let context = text.slice(before, after);

    // Add ellipsis if we trimmed
    if (before > 0) {
        context = '...' + context;
    }
    if (after < text.length) {
        context = context + '...';
    }

    return context.trim();
}
