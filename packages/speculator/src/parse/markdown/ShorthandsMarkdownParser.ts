/**
 * Shorthands Markdown Parser
 * 
 * Detects ReSpec-like shorthands in text nodes and transforms them to Speculator AST nodes.
 */

import type { Text, RootContent as MdastRootContent } from 'mdast';
import type { MarkdownParserModule, ParseContext, InlineHandlerResult, NodeWithPosition } from '#src/parse/registry';
import type { Inline, InlineCite, InlineWorkspaceDfnReference, InlineWorkspaceIdlReference, InlineWorkspaceElementReference, InlineVariable, InlineSectionReference } from '#src/types/ast.generated';

/**
 * Definition of a shorthand and its implementation status
 */
export interface ShorthandDefinition {
    name: string;
    syntax: string;
    description: string;
    pattern: RegExp;
    status: 'implemented' | 'planned' | 'not-planned';
    handler: (match: RegExpExecArray, ctx: ParseContext, node: NodeWithPosition) => Inline;
}

/**
 * Registry of supported shorthands.
 * This satisfies the requirement to track what shorthands are implemented.
 */
export const SHORTHAND_REGISTRY: ShorthandDefinition[] = [
    {
        name: 'reference-expanded',
        syntax: '[[[REF]]]',
        description: 'Citation with full title',
        pattern: /\[\[\[([^\]|]+)\]\]\]/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const result: InlineCite = {
                type: 'cite',
                key: match[1],
                expanded: true,
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'reference',
        syntax: '[[REF]]',
        description: 'Citation to a specification',
        // Use a negative lookahead to ensure we don't match [[[ (which is reference-expanded)
        pattern: /\[\[(?![[])(!|\?)?([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const forced = match[1];
            const key = match[2];
            const result: InlineCite = {
                type: 'cite',
                key: key,
            };
            if (forced === '!') result.forcedNormative = true;
            if (forced === '?') result.forcedInformative = true;
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'concept',
        syntax: '[=term=]',
        description: 'Internal concept reference',
        pattern: /\[=([^=|]+)(?:\|([^=]+))?=\]/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const term = match[1];
            const alias = match[2];
            const result: InlineWorkspaceDfnReference = {
                type: 'workspaceDfnReference',
                targetTerm: term,
                children: alias 
                    ? [{ type: 'text', value: alias }]
                    : [{ type: 'text', value: term }],
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'variable',
        syntax: '|variable|',
        description: 'Algorithm variable',
        pattern: /\|([^|:\s][^|:]*?)\|/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const name = match[1];
            // const type = match[2]; // Type info could be added if schema supports it
            const result: InlineVariable = {
                type: 'variable',
                value: name,
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'webidl',
        syntax: '{{Identifier}}',
        description: 'WebIDL interface reference',
        pattern: /\{\{([^?!][^}]*)\}\}/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const result: InlineWorkspaceIdlReference = {
                type: 'workspaceIdlReference',
                targetTerm: match[1],
                children: [{ type: 'text', value: match[1] }],
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'element',
        syntax: '[^tag^]',
        description: 'HTML/SVG element reference',
        pattern: /\[\^([^\]]+)\^\]/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const result: InlineWorkspaceElementReference = {
                type: 'workspaceElementReference',
                targetTerm: match[1],
                children: [{ type: 'text', value: match[1] }],
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
    {
        name: 'section-reference',
        syntax: '[§#id]',
        description: 'Reference to a section',
        pattern: /\[§#([^\]|]+)(?:\|([^\]]+))?\]/g,
        status: 'implemented',
        handler: (match, ctx, node) => {
            const id = match[1];
            const alias = match[2];
            const result: InlineSectionReference = {
                type: 'sectionReference',
                targetId: id,
                children: alias 
                    ? [{ type: 'text', value: alias }]
                    : undefined,
            };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        },
    },
];

/**
 * Markdown parser module for shorthands.
 * Priority-based: it handles 'text' nodes and splits them into fragments.
 */
export const ShorthandsMarkdownParser: MarkdownParserModule = {
    name: 'ShorthandsMarkdownParser',
    handles: ['text'],
    order: 5, // High priority to catch shorthands before general text processing

    handleInline(node: MdastRootContent, ctx: ParseContext): InlineHandlerResult {
        if (node.type !== 'text') return null;
        const textNode = node as Text;
        const content = textNode.value;

        // Try to find the first shorthand match
        let bestMatch: { start: number; end: number; shorthand: ShorthandDefinition; match: RegExpExecArray } | null = null;

        for (const shorthand of SHORTHAND_REGISTRY) {
            if (shorthand.status !== 'implemented') continue;
            
            shorthand.pattern.lastIndex = 0;
            const match = shorthand.pattern.exec(content);
            if (match) {
                if (!bestMatch || match.index < bestMatch.start) {
                    bestMatch = {
                        start: match.index,
                        end: shorthand.pattern.lastIndex,
                        shorthand,
                        match,
                    };
                }
            }
        }

        // FALLBACK: If no shorthand matched, return standard text node
        if (!bestMatch) {
            const result: Inline = { type: 'text', value: content };
            const sourcePos = ctx.createSourcePos(node);
            if (sourcePos) result.sourcePos = sourcePos;
            return result;
        }

        // Split text into: [prefix] [shorthand] [suffix]
        const prefix = content.substring(0, bestMatch.start);
        const suffix = content.substring(bestMatch.end);
        
        const nodes: Inline[] = [];

        // 1. Prefix (if any)
        if (prefix) {
            const prefixNode: Inline = { type: 'text', value: prefix };
            // Note: complex sourcePos mapping for fragments is omitted for simplicity
            // in line with other parsers that don't do byte-perfect fragment tracking.
            nodes.push(prefixNode);
        }

        // 2. Shorthand node
        nodes.push(bestMatch.shorthand.handler(bestMatch.match, ctx, node));

        // 3. Suffix (processed recursively to find more shorthands)
        if (suffix) {
            const suffixNode: Text = { type: 'text', value: suffix };
            const suffixResult = this.handleInline!(suffixNode, ctx);
            if (Array.isArray(suffixResult)) {
                nodes.push(...suffixResult);
            } else if (suffixResult) {
                nodes.push(suffixResult as Inline);
                // No need to check for null here as we know we'd return a text node at least
            }
        }

        return nodes;
    },
};
