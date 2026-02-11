/**
 * Escape Pipe Middleware
 * 
 * Escapes pipe characters in shorthands to prevent them from breaking Markdown tables.
 * This is applied to SourceUnits before parsing.
 */

import type { CompositeSource } from '#src/preprocess/types';

/**
 * Regex definitions for escaping pipes in shorthands.
 * These are slightly different from parser regexes as they focus on capturing the pipe.
 */
const REPLACEMENTS = [
    // Section reference with alias: [§#id|alias] -> [§#id\|alias]
    // We use [^\\\|] to ensure the character before | is not a backslash (nor a pipe)
    {
        pattern: /(\[§#[^\]|]*[^\\|])\|([^\]]+\])/g,
        replacement: '$1\\|$2',
    },
    // Concept reference with alias: [=term|alias=] -> [=term\|alias=]
    {
        pattern: /(\[=[^=|]*[^\\|])\|([^=]+=])/g,
        replacement: '$1\\|$2',
    },
    // Variable: |var| -> \|var\|
    // To identify variables vs table cells, we assume variables are:
    // 1. Not empty (| | is likely table)
    // 2. Not starting/ending with space (which would be table spacing)
    // 3. Surrounded by non-word characters or space, or start of line (to be safe)
    // 
    // We match: | followed by non-space/colon, content, pipe.
    // AND require the pipe to be NOT followed by space-then-pipe (which suggests table cell | var | )
    // Actually, | var | is a table cell with content "var". 
    // |var| is a variable "var".
    // 
    // If we have | |var| |, the inner |var| matches.
    // If we have |col|, it matches.
    // 
    // Strategy: We strictly match |x| where x has no spaces.
    // Users who want compact tables |col|val| will have to escape like \|col\|val\| if they really want literal pipes,
    // OR we accept that |col| is parsed as variable if it matches the variable syntax.
    // 
    // BUT, |col| in a table row:
    // | col | val | -> col has spaces around.
    // |col|val| -> col has no spaces.
    // 
    // Let's try to match only if NOT at start/end of line?
    // But |var| can be at start of line in paragraph.
    //
    // Revised Strategy: 
    // We only match |var| if it is NOT immediately followed by another |.
    // In |col|val|, |col| is followed by val|.
    // In |col| val|, |col| is followed by  val|.
    // In | |var| |, |var| is followed by  |. Matches!
    // 
    // But |col|val|:
    // |col| matches. followed by v. Matches!
    // 
    // Wait, |col|val|. 
    // |col| -> `col`.
    // |col| is a variable candidate.
    // 
    // If we require spaces around? `(?<=^|\s)\|...\|(?=$|\s)`
    // But user might write `(|var|)`
    // 
    // New Strategy:
    // Only match |var| if the content DOES NOT look like it belongs to a table structure row logic.
    // Deep regex is hard.
    // 
    // Practical Compromise:
    // We escape |var| -> \|var\|
    // User cannot use compact tables like |a|b| if 'a' or 'b' look like variables.
    // They must use spaces: | a | b |.
    // This seems acceptable for "making it possible" while keeping standard tables working (standard tables usually have spaces).
    // Note: ensure we don't match already escaped \|var\|
    {
        pattern: /(?<!\\)\|([^|:\s][^|:]*?)\|/g,
        replacement: '\\|$1\\|',
    },
];

/**
 * Escape pipes in all markdown units within a CompositeSource
 */
export function escapePipesInSource(source: CompositeSource): CompositeSource {
    const newUnits = source.units.map(unit => {
        if (unit.format !== 'markdown') return unit;

        let content = unit.content;
        for (const { pattern, replacement } of REPLACEMENTS) {
            content = content.replace(pattern, replacement);
        }

        if (content === unit.content) return unit;

        return {
            ...unit,
            content,
        };
    });

    return {
        ...source,
        units: newUnits,
    };
}
