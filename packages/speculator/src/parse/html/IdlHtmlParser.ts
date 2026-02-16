/**
 * IDL HTML Parser
 *
 * Parses <pre class="idl"> blocks to extract WebIDL definitions.
 * Tokenizes the content to generate a BlockIdl node with Inline children.
 * - Definitions (interfaces, members) become InlineDefinition.
 * - Types become Reference nodes (to be linked).
 * - Keywords/Punctuation become Text nodes.
 */

import type { Element } from 'hast';
import type { HtmlParserModule, ParseContext, BlockHandlerResult } from '#src/parse/registry';
import type { Inline, InlineDefinition, BlockIdl, InlineWorkspaceIdlReference } from '#src/types/ast.generated';
import { CodeHtmlParser } from './CodeHtmlParser.js';

// Keywords that start a definition
const DEF_KEYWORDS = new Set(['interface', 'dictionary', 'enum', 'callback', 'typedef', 'partial']);

// Keywords to ignore (not types or names)
const IGNORED_KEYWORDS = new Set([
    'readonly', 'attribute', 'required', 'const', 'serializer', 'stringifier', 'inherit', 
    'static', 'getter', 'setter', 'deleter', 'legacycaller', 'iterable', 'maplike', 'setlike'
]);

// Helper to check if a word is likely a type or name
function isIdentifier(word: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word);
}

export const IdlHtmlParser: HtmlParserModule = {
    name: 'IdlHtmlParser',
    handles: ['pre'],
    order: 9, // Must be lower than CodeHtmlParser (10)

    handleBlock(element: Element, ctx: ParseContext): BlockHandlerResult {
        // Check if it's an IDL block
        const className = ctx.getAttr(element, 'class') ?? ctx.getAttr(element, 'className');
        if (!className || !className.split(/\s+/).includes('idl')) {
            // Fallback to standard code parser for non-IDL pre blocks
            return CodeHtmlParser.handleBlock!(element, ctx);
        }

        const content = ctx.getTextContent(element);
        const sourcePos = ctx.createSourcePos(element);
        
        const children: Inline[] = [];
        
        // Tokenization State
        let currentContext: 'top-level' | 'interface' | 'dictionary' | 'enum' | 'typedef' = 'top-level';
        let contextName: string | null = null;
        let expectingNameFor: string | null = null; // 'interface', 'dictionary', etc.
        let expectingMemberName = false;
        
        // Simple tokenizer: split by delimiters but keep them
        // Delimiters: whitespace, {};(),=?
        const tokens = content.split(/([ \t\n\r]+|[{};(),=?])/);

        for (const token of tokens) {
            if (!token) continue;

            // Handle whitespace/punctuation
            if (/^[ \t\n\r]+$/.test(token) || /^[{};(),=?]$/.test(token)) {
                children.push({ type: 'text', value: token, sourcePos }); // TODO: finer pos

                // State transitions based on punctuation
                if (token === '{') {
                    // Enter context
                } else if (token === '}') {
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

            // Handle Words
            if (DEF_KEYWORDS.has(token)) {
                children.push({ type: 'text', value: token, sourcePos });
                expectingNameFor = token; // Next identifier is the name being defined
            } else if (IGNORED_KEYWORDS.has(token)) {
                 children.push({ type: 'text', value: token, sourcePos });
            } else if (isIdentifier(token)) {
                // Decision: Definition or Reference?
                
                if (expectingNameFor) {
                    // This is a Definition! (e.g., interface MyInterface)
                    const dfnType = expectingNameFor === 'interface' ? 'interface' :
                                    expectingNameFor === 'dictionary' ? 'dictionary' :
                                    expectingNameFor === 'enum' ? 'enum' : 'typedef';
                    
                    children.push({
                        type: 'definition',
                        term: token,
                        dfnType,
                        sourcePos,
                        children: [{ type: 'text', value: token }]
                    } as InlineDefinition);

                    contextName = token;
                    currentContext = dfnType;
                    expectingNameFor = null; // Reset
                } else if (contextName && (currentContext === 'interface' || currentContext === 'dictionary')) {
                    // We are inside an interface/dictionary.
                    // Is this a Type or a Member Name?
                    // Heuristic: If it's followed by (; or = or (), it's likely a member name.
                    // But we are processing stream.
                    // A better heuristic for IDL: Type MemberName;
                    // So if we just saw a Type, this is a MemberName.
                    // This simple tokenizer is too state-light for perfect parsing.
                    // 
                    // Let's use a simpler heuristic:
                    // If it matches a known Type pattern (starts with Uppercase), treat as Reference.
                    // If it starts with lowercase, treat as Member Name (Definition), unless it's a primitive type.
                    
                    const isPrimitive = ['long', 'unsigned', 'short', 'float', 'double', 'boolean', 'byte', 'octet', 'void', 'any', 'object'].includes(token);
                    
                    if (isPrimitive) {
                         children.push({ type: 'text', value: token, sourcePos });
                         expectingMemberName = true; // Next lowercase identifier is likely the member
                    } else if (/^[A-Z]/.test(token)) {
                        // Uppercase -> Likely a Type Reference
                        children.push({
                            type: 'workspaceIdlReference',
                            targetTerm: token,
                            children: [{ type: 'text', value: token }]
                        } as InlineWorkspaceIdlReference);
                        expectingMemberName = true;
                    } else {
                        // Lowercase -> Likely a Member Name (if we are expecting one)
                        // or a primitive type we missed?
                        if (expectingMemberName) {
                             const fullTerm = `${contextName}/${token}`;
                             children.push({
                                type: 'definition',
                                term: fullTerm,
                                dfnType: currentContext === 'interface' ? 'method' : 'field',
                                sourcePos,
                                children: [{ type: 'text', value: token }]
                            } as InlineDefinition);
                            expectingMemberName = false;
                        } else {
                             // Just text?
                             children.push({ type: 'text', value: token, sourcePos });
                        }
                    }
                } else {
                    // Default to text or reference?
                    // If it looks like a type, reference it.
                    if (/^[A-Z]/.test(token)) {
                         children.push({
                            type: 'workspaceIdlReference',
                            targetTerm: token,
                            children: [{ type: 'text', value: token }]
                        } as InlineWorkspaceIdlReference);
                    } else {
                        children.push({ type: 'text', value: token, sourcePos });
                    }
                }
            } else {
                // Fallback for unknown tokens
                children.push({ type: 'text', value: token, sourcePos });
            }
        }

        return {
            type: 'idl',
            value: content,
            sourcePos,
            children
        } as unknown as BlockIdl; // Type assertion needed until registry types update
    }
};
