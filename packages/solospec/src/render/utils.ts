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
