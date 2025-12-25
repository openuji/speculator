import type { LintResult } from '@openuji/speculator-lint';

export interface DiagnosticsByFile {
    [file: string]: Array<{
        code: string;
        severity: 'error' | 'warning' | 'info';
        message: string;
        line?: number;
        column?: number;
    }>;
}

/**
 * Group diagnostics by file
 */
export function groupDiagnosticsByFile(lintResult: LintResult): DiagnosticsByFile {
    const grouped: DiagnosticsByFile = {};

    for (const diagnostic of lintResult.diagnostics) {
        const file = diagnostic.file || 'unknown';
        if (!grouped[file]) {
            grouped[file] = [];
        }
        grouped[file].push({
            code: diagnostic.code,
            severity: diagnostic.severity,
            message: diagnostic.message,
            line: diagnostic.sourcePos?.line,
            column: diagnostic.sourcePos?.column,
        });
    }

    return grouped;
}

/**
 * Render diagnostics as HTML
 */
export function renderDiagnosticsHtml(lintResult: LintResult): string {
    const grouped = groupDiagnosticsByFile(lintResult);
    const files = Object.keys(grouped);

    if (files.length === 0) {
        return '<div class="diagnostics-panel"><p>✅ No issues found</p></div>';
    }

    const sections = files.map(file => {
        const diagnostics = grouped[file];
        const items = diagnostics.map(d => {
            const severityClass = `diagnostic-${d.severity}`;
            const location = d.line ? ` (line ${d.line}${d.column ? `:${d.column}` : ''})` : '';
            return `
                <li class="${severityClass}">
                    <strong>${d.code}</strong>: ${d.message}${location}
                </li>
            `;
        }).join('');

        return `
            <div class="diagnostic-file">
                <h4>${file}</h4>
                <ul class="diagnostic-list">
                    ${items}
                </ul>
            </div>
        `;
    }).join('');

    const errorCount = lintResult.diagnostics.filter(d => d.severity === 'error').length;
    const warningCount = lintResult.diagnostics.filter(d => d.severity === 'warning').length;

    return `
        <div class="diagnostics-panel">
            <h3>📋 Diagnostics</h3>
            <p class="diagnostic-summary">
                ${errorCount} error${errorCount !== 1 ? 's' : ''}, 
                ${warningCount} warning${warningCount !== 1 ? 's' : ''}
            </p>
            ${sections}
        </div>
    `;
}
