import type { Inline, InlineDefinition, InlineWorkspaceIdlReference, SourcePos } from '#src/types/ast.generated';

// Keywords that start a definition.
const DEF_KEYWORDS = new Set(['interface', 'dictionary', 'enum', 'callback', 'typedef', 'partial']);

// Keywords to ignore (not types or names).
const IGNORED_KEYWORDS = new Set([
    'readonly', 'attribute', 'required', 'const', 'serializer', 'stringifier', 'inherit',
    'static', 'getter', 'setter', 'deleter', 'legacycaller', 'iterable', 'maplike', 'setlike',
]);

const PRIMITIVE_TYPES = new Set([
    'long', 'unsigned', 'short', 'float', 'double', 'boolean', 'byte', 'octet', 'void', 'any', 'object',
]);

function createTextInline(value: string, sourcePos?: SourcePos): Inline {
    if (sourcePos) {
        return { type: 'text', value, sourcePos };
    }
    return { type: 'text', value };
}

function createWorkspaceIdlReference(targetTerm: string, sourcePos?: SourcePos): InlineWorkspaceIdlReference {
    if (sourcePos) {
        return {
            type: 'workspaceIdlReference',
            targetTerm,
            sourcePos,
            children: [{ type: 'text', value: targetTerm }],
        };
    }

    return {
        type: 'workspaceIdlReference',
        targetTerm,
        children: [{ type: 'text', value: targetTerm }],
    };
}

function isIdentifier(word: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word);
}

/**
 * Tokenizes WebIDL text into inline nodes used by BlockIdl.
 * This is intentionally heuristic and shared by both HTML and Markdown IDL parsing.
 */
export function tokenizeIdlContent(content: string, sourcePos?: SourcePos): Inline[] {
    const children: Inline[] = [];

    let currentContext: 'top-level' | 'interface' | 'dictionary' | 'enum' | 'typedef' = 'top-level';
    let contextName: string | null = null;
    let expectingNameFor: string | null = null;
    let expectingMemberName = false;

    // Delimiters: whitespace, punctuation, and type wrapper tokens used in IDL type expressions.
    const tokens = content.split(/([ \t\n\r]+|[{};(),=?<>[\]:])/);

    for (const token of tokens) {
        if (!token) continue;

        if (/^[ \t\n\r]+$/.test(token) || /^[{};(),=?]$/.test(token)) {
            children.push(createTextInline(token, sourcePos));

            if (token === '}') {
                currentContext = 'top-level';
                contextName = null;
            } else if (token === ';') {
                expectingMemberName = false;
                if (currentContext === 'top-level') {
                    expectingNameFor = null;
                }
            }
            continue;
        }

        if (DEF_KEYWORDS.has(token)) {
            children.push(createTextInline(token, sourcePos));
            expectingNameFor = token;
            continue;
        }

        if (IGNORED_KEYWORDS.has(token)) {
            children.push(createTextInline(token, sourcePos));
            continue;
        }

        if (!isIdentifier(token)) {
            children.push(createTextInline(token, sourcePos));
            continue;
        }

        if (expectingNameFor) {
            const dfnType = expectingNameFor === 'interface'
                ? 'interface'
                : expectingNameFor === 'dictionary'
                    ? 'dictionary'
                    : expectingNameFor === 'enum'
                        ? 'enum'
                        : 'typedef';

            const definition: InlineDefinition = {
                type: 'definition',
                term: token,
                dfnType,
                children: [{ type: 'text', value: token }],
            };
            if (sourcePos) {
                definition.sourcePos = sourcePos;
            }

            children.push(definition);
            contextName = token;
            currentContext = dfnType;
            expectingNameFor = null;
            continue;
        }

        if (contextName && (currentContext === 'interface' || currentContext === 'dictionary')) {
            if (PRIMITIVE_TYPES.has(token)) {
                children.push(createWorkspaceIdlReference(token, sourcePos));
                expectingMemberName = true;
                continue;
            }

            if (/^[A-Z]/.test(token)) {
                children.push(createWorkspaceIdlReference(token, sourcePos));
                expectingMemberName = true;
                continue;
            }

            if (expectingMemberName) {
                const memberDefinition: InlineDefinition = {
                    type: 'definition',
                    term: `${contextName}/${token}`,
                    dfnType: currentContext === 'interface' ? 'method' : 'field',
                    children: [{ type: 'text', value: token }],
                };
                if (sourcePos) {
                    memberDefinition.sourcePos = sourcePos;
                }
                children.push(memberDefinition);
                expectingMemberName = false;
                continue;
            }

            children.push(createTextInline(token, sourcePos));
            continue;
        }

        if (/^[A-Z]/.test(token)) {
            children.push(createWorkspaceIdlReference(token, sourcePos));
        } else {
            children.push(createTextInline(token, sourcePos));
        }
    }

    return children;
}
