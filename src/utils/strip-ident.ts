export function stripIndent(content: string): string {
  // Normalize line endings
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  // Determine smallest indentation from non-empty lines
  const indents = lines
    .filter(line => line.trim().length > 0)
    .map(line => line.match(/^\s*/)?.[0].length || 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 0;
  // Remove that indentation from all lines
  return lines.map(line => line.slice(minIndent)).join('\n');
}