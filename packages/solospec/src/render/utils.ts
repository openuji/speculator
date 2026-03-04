import type { Inline } from '@openuji/speculator';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttr(value: string): string {
  return escapeHtml(value);
}

export function joinHref(basePath: string, documentId: string, targetId?: string): string {
  const cleanBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath;
  const anchor = targetId ? `#${targetId}` : '';
  return `${cleanBase}/${documentId}${anchor}`;
}

export function renderInlineText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      switch (node.type) {
        case 'text':
          return node.value;
        case 'inlineCode':
          return node.value;
        case 'emphasis':
        case 'strong':
        case 'link':
        case 'definition':
        case 'workspaceDfnReference':
        case 'workspaceIdlReference':
        case 'workspaceElementReference':
        case 'externalDfnReference':
        case 'externalIdlReference':
        case 'externalElementReference':
        case 'sectionReference':
          return renderInlineText(node.children || []);
        case 'cite':
          if (node.children && node.children.length > 0) {
            return renderInlineText(node.children);
          }
          return `[${node.key}]`;
        case 'requirement':
          return node.keyword;
        case 'issue':
          return node.children.map((child) => renderInlineText([child])).join('');
        case 'variable':
          return node.value;
        case 'image':
          return node.alt || '';
        default:
          return '';
      }
    })
    .join('');
}

export function dedent(code: string): string {
  const getLeadingIndentWidth = (line: string): number => {
    const indentMatch = line.match(/^[\t ]*/);
    if (!indentMatch) return 0;
    return indentMatch[0].replace(/\t/g, '    ').length;
  };

  const stripIndent = (line: string, amount: number): string => {
    let currentLine = line;
    let removed = 0;
    while (removed < amount && (currentLine.startsWith(' ') || currentLine.startsWith('\t'))) {
      if (currentLine.startsWith('\t')) {
        if (removed + 4 <= amount) {
          currentLine = currentLine.slice(1);
          removed += 4;
        } else {
          break;
        }
      } else {
        currentLine = currentLine.slice(1);
        removed += 1;
      }
    }
    return currentLine;
  };

  const lines = code.split('\n');

  // Find the first and last non-empty lines
  let start = 0;
  while (start < lines.length && lines[start].trim() === '') start++;
  let end = lines.length - 1;
  while (end >= 0 && lines[end].trim() === '') end--;

  if (start > end) return '';

  const relevantLines = lines.slice(start, end + 1);

  const nonEmptyLines = relevantLines
    .map((line) => ({
      line,
      indent: getLeadingIndentWidth(line),
    }))
    .filter((entry) => entry.line.trim() !== '');

  if (nonEmptyLines.length === 0) return '';

  let minIndent = Math.min(...nonEmptyLines.map((entry) => entry.indent));

  if (minIndent === 0 && nonEmptyLines.length > 1) {
    const [firstNonEmpty, ...restNonEmpty] = nonEmptyLines;
    const lastNonEmpty = nonEmptyLines[nonEmptyLines.length - 1];
    const minRestIndent = Math.min(...restNonEmpty.map((entry) => entry.indent));
    const firstText = firstNonEmpty.line.trimEnd();
    const lastText = lastNonEmpty.line.trimStart();

    // Markdown-in-HTML <pre> parsing can leave the first line unindented while the rest retain outer indentation.
    // When the block opens/closes with bracket delimiters, normalize against the remaining lines.
    const startsIndentedBlock =
      firstNonEmpty.indent === 0 &&
      minRestIndent > 0 &&
      (firstText.endsWith('{') || firstText.endsWith('[') || firstText.endsWith('('));
    const endsIndentedBlock =
      lastNonEmpty.indent > 0 &&
      (lastText.startsWith('}') || lastText.startsWith(']') || lastText.startsWith(')'));

    if (startsIndentedBlock && endsIndentedBlock) {
      minIndent = minRestIndent;
    }
  }

  if (minIndent === 0) return relevantLines.join('\n');

  return relevantLines.map((line) => stripIndent(line, minIndent)).join('\n');
}
