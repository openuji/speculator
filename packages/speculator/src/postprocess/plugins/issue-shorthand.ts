/**
 * Issue Shorthand Transform Plugin
 *
 * Converts Bikeshed-style issue shorthands in paragraphs:
 *   Issue(78):
 *   Issue(#78):
 * Into issue-type notes with canonical GitHub issue links resolved
 * against config.repository when needed.
 */

import type { Plugin, TransformContext } from '#src/pipeline/types';
import type {
    Block,
    BlockNote,
    BlockParagraph,
    Document,
    Inline,
    Section,
} from '#src/types/ast.generated';
import type { SpecConfig } from '#src/preprocess/types';

const ISSUE_SHORTHAND_RE = /^Issue\(\s*([^)]+?)\s*\)\s*:\s*/i;

function extractGitHubRepoSlug(repository: SpecConfig['repository']): string | null {
    if (!repository) return null;

    const raw = (typeof repository === 'string' ? repository : repository.url)?.trim();
    if (!raw) return null;

    const directMatch = raw.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/);
    if (directMatch) return directMatch[1].replace(/\.git$/i, '');

    const sshMatch = raw.match(/^git@github\.com:([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+?)(?:\.git)?\/?$/i);
    if (sshMatch) return sshMatch[1].replace(/\.git$/i, '');

    try {
        const parsed = new URL(raw);
        if (parsed.hostname.toLowerCase() !== 'github.com') return null;

        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return null;

        const owner = parts[0];
        const repo = parts[1].replace(/\.git$/i, '');
        if (!owner || !repo) return null;

        return `${owner}/${repo}`;
    } catch {
        return null;
    }
}

function resolveIssueTarget(
    identifier: string,
    repoSlug: string | null
): { url: string; label: string } | null {
    const ref = identifier.trim();
    if (!ref) return null;

    const localMatch = ref.match(/^#?(\d+)$/);
    if (localMatch) {
        if (!repoSlug) return null;
        const issueNumber = localMatch[1];
        return {
            url: `https://github.com/${repoSlug}/issues/${issueNumber}`,
            label: `#${issueNumber}`,
        };
    }

    const explicitRepoMatch = ref.match(/^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)#(\d+)$/);
    if (explicitRepoMatch) {
        const issueNumber = explicitRepoMatch[2];
        return {
            url: `https://github.com/${explicitRepoMatch[1]}/issues/${issueNumber}`,
            label: `#${issueNumber}`,
        };
    }

    const githubUrlMatch = ref.match(/^https?:\/\/github\.com\/([^/\s]+\/[^/\s]+)\/issues\/(\d+)(?:[/?#].*)?$/i);
    if (githubUrlMatch) {
        const issueNumber = githubUrlMatch[2];
        return {
            url: `https://github.com/${githubUrlMatch[1]}/issues/${issueNumber}`,
            label: `#${issueNumber}`,
        };
    }

    return null;
}

function trimLeadingInlineWhitespace(inlines: Inline[]): Inline[] {
    const output = [...inlines];

    while (output.length > 0 && output[0].type === 'text') {
        const trimmed = output[0].value.replace(/^\s+/, '');
        if (trimmed.length === 0) {
            output.shift();
            continue;
        }
        output[0] = { ...output[0], value: trimmed };
        break;
    }

    return output;
}

function inlineToPlainText(inline: Inline): string {
    switch (inline.type) {
        case 'text':
        case 'inlineCode':
        case 'variable':
            return inline.value;
        case 'workspaceDfnReference':
        case 'workspaceIdlReference':
        case 'workspaceElementReference':
        case 'externalDfnReference':
        case 'externalIdlReference':
        case 'externalElementReference':
            return inline.targetTerm;
        case 'requirement':
            return inline.keyword;
        case 'issue':
            return inline.id ? `#${inline.id}` : '';
        case 'image':
            return inline.alt || '';
        case 'sectionReference':
            return inline.children ? inline.children.map(inlineToPlainText).join('') : '';
        case 'cite':
        case 'definition':
        case 'emphasis':
        case 'strong':
        case 'link':
        case 'htmlInlineElement':
            return (inline.children ?? []).map(inlineToPlainText).join('');
        default:
            return '';
    }
}

function inlinesToPlainText(inlines: Inline[]): string {
    return inlines.map(inlineToPlainText).join('');
}

function consumeInlinePrefix(inlines: Inline[], charCount: number): Inline[] {
    if (charCount <= 0) return [...inlines];

    const output: Inline[] = [];
    let remaining = charCount;

    for (const inline of inlines) {
        if (remaining <= 0) {
            output.push(inline);
            continue;
        }

        if (inline.type === 'text') {
            if (inline.value.length <= remaining) {
                remaining -= inline.value.length;
                continue;
            }

            output.push({
                ...inline,
                value: inline.value.slice(remaining),
            });
            remaining = 0;
            continue;
        }

        const length = inlineToPlainText(inline).length;
        if (length <= remaining) {
            remaining -= length;
            continue;
        }

        output.push(inline);
        remaining = 0;
    }

    return output;
}

function hasInlineContent(inlines: Inline[]): boolean {
    return inlines.some((inline) => inline.type !== 'text' || inline.value.trim().length > 0);
}

function convertParagraphIfIssueShorthand(
    paragraph: BlockParagraph,
    repoSlug: string | null
): BlockNote | null {
    const paragraphText = inlinesToPlainText(paragraph.children);
    const match = paragraphText.match(ISSUE_SHORTHAND_RE);
    if (!match) return null;

    const identifier = match[1]?.trim();
    if (!identifier) return null;

    const issueTarget = resolveIssueTarget(identifier, repoSlug);
    if (!issueTarget) return null;

    const trimmedRemainder = trimLeadingInlineWhitespace(
        consumeInlinePrefix(paragraph.children, match[0].length)
    );

    const noteChildren: Block[] = [
        {
            type: 'paragraph',
            children: [
                { type: 'text', value: 'Open issue: ' },
                {
                    type: 'link',
                    url: issueTarget.url,
                    children: [{ type: 'text', value: issueTarget.label }],
                },
            ],
        },
    ];

    if (hasInlineContent(trimmedRemainder)) {
        noteChildren.push({
            type: 'paragraph',
            children: trimmedRemainder,
        });
    }

    const result: BlockNote = {
        type: 'note',
        noteType: 'issue',
        informative: true,
        src: issueTarget.url,
        children: noteChildren,
    };

    if (paragraph.id) result.id = paragraph.id;
    if (paragraph.sourcePos) result.sourcePos = paragraph.sourcePos;

    return result;
}

function transformBlockList(blocks: Block[], repoSlug: string | null): void {
    for (let i = 0; i < blocks.length; i++) {
        const current = blocks[i];

        if (current.type === 'paragraph') {
            const converted = convertParagraphIfIssueShorthand(current, repoSlug);
            if (converted) {
                blocks[i] = converted;
                continue;
            }
        }

        switch (current.type) {
            case 'note':
            case 'example':
            case 'blockquote':
            case 'htmlElement':
            case 'specStatementGroup':
                transformBlockList(current.children, repoSlug);
                break;
            case 'list':
                for (const item of current.children) {
                    transformBlockList(item.children, repoSlug);
                }
                break;
            default:
                break;
        }
    }
}

function transformSectionList(nodes: (Section | Block)[], repoSlug: string | null): void {
    for (let i = 0; i < nodes.length; i++) {
        const current = nodes[i];

        if (current.type === 'section') {
            transformSectionList(current.children, repoSlug);
            continue;
        }

        if (current.type === 'paragraph') {
            const converted = convertParagraphIfIssueShorthand(current, repoSlug);
            if (converted) {
                nodes[i] = converted;
                continue;
            }
        }

        switch (current.type) {
            case 'note':
            case 'example':
            case 'blockquote':
            case 'htmlElement':
            case 'specStatementGroup':
                transformBlockList(current.children, repoSlug);
                break;
            case 'list':
                for (const item of current.children) {
                    transformBlockList(item.children, repoSlug);
                }
                break;
            default:
                break;
        }
    }
}

function transformIssueShorthands(document: Document, config: SpecConfig): void {
    const repoSlug = extractGitHubRepoSlug(config.repository);
    transformSectionList(document.children, repoSlug);
}

export const issueShorthandPlugin: Plugin = {
    name: 'issue-shorthand',
    order: { transform: 15 },
    async transform(ctx: TransformContext): Promise<void> {
        transformIssueShorthands(ctx.document, ctx.config);
    },
};
