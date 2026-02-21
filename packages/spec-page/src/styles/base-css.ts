export const BASE_PAGE_CSS = `
:root {
  --spec-bg: #f7f8fb;
  --spec-surface: #ffffff;
  --spec-line: #d8deec;
  --spec-ink: #141927;
  --spec-muted: #5e667a;
  --spec-accent: #0f766e;
  --spec-warn: #c2410c;
  --spec-danger: #b91c1c;
}

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: var(--spec-bg);
  color: var(--spec-ink);
  font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
  line-height: 1.55;
}

a {
  color: #0b5cab;
}

a:hover {
  color: #0b4a8a;
}

code,
pre,
var {
  font-family: "IBM Plex Mono", "Fira Code", monospace;
}

.spec-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem;
}

.spec-header {
  background: var(--spec-surface);
  border: 1px solid var(--spec-line);
  border-radius: 14px;
  padding: 1.2rem 1.3rem;
  margin-bottom: 1rem;
}

.spec-title {
  margin: 0;
  font-size: 1.95rem;
}

.spec-subtitle {
  margin: 0.35rem 0 0;
  color: var(--spec-muted);
}

.spec-abstract {
  margin-top: 0.7rem;
}

.spec-meta {
  margin-top: 1rem;
  display: grid;
  gap: 0.45rem;
}

.spec-meta-row {
  display: grid;
  grid-template-columns: 170px 1fr;
  gap: 0.7rem;
}

.spec-meta-row dt {
  color: var(--spec-muted);
  font-weight: 600;
}

.spec-meta-row dd {
  margin: 0;
}

.spec-layout {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.toc {
  position: sticky;
  top: 1rem;
  max-height: calc(100vh - 2rem);
  overflow: auto;
  background: var(--spec-surface);
  border: 1px solid var(--spec-line);
  border-radius: 14px;
  padding: 1rem;
}

.toc h2 {
  margin: 0 0 0.65rem;
  font-size: 1rem;
}

.toc ol {
  margin: 0;
  padding-left: 1rem;
}

.toc li {
  margin: 0.3rem 0;
}

.toc-number {
  display: inline-block;
  color: var(--spec-muted);
  min-width: 2.2em;
}

.spec-article {
  background: var(--spec-surface);
  border: 1px solid var(--spec-line);
  border-radius: 14px;
  padding: 1.25rem;
}

.spec-prose p,
.spec-prose ul,
.spec-prose ol,
.spec-prose table,
.spec-prose blockquote,
.spec-prose pre,
.spec-prose .ui-callout,
.spec-prose .mermaid-shell,
.spec-prose .likec4-shell,
.spec-prose .idl-block {
  margin: 0.85rem 0;
}

.spec-prose blockquote {
  border-left: 4px solid var(--spec-line);
  padding: 0.5rem 0.8rem;
  background: #f7fafc;
}

.spec-prose ul,
.spec-prose ol {
  padding-left: 1.4rem;
}

.spec-prose table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--spec-line);
}

.spec-prose th,
.spec-prose td {
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid var(--spec-line);
}

.spec-prose th {
  text-align: left;
  background: #f1f4fa;
}

.section-heading {
  scroll-margin-top: 1.4rem;
}

.section-number {
  color: var(--spec-muted);
  margin-right: 0.35rem;
}

.ui-code-block,
.idl-block {
  border: 1px solid var(--spec-line);
  border-radius: 12px;
  overflow: hidden;
}

.ui-code-header,
.idl-block-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.83rem;
  color: var(--spec-muted);
  background: #f4f6fc;
  border-bottom: 1px solid var(--spec-line);
  padding: 0.35rem 0.6rem;
}

.ui-code-block pre,
.idl-block-pre {
  margin: 0;
  padding: 0.65rem;
  overflow-x: auto;
}

.idl-copy-btn {
  border: 1px solid var(--spec-line);
  border-radius: 8px;
  background: #fff;
  padding: 0.2rem 0.45rem;
  cursor: pointer;
}

.ui-callout {
  border: 1px solid var(--spec-line);
  border-radius: 12px;
  padding: 0.7rem;
}

.ui-callout header {
  margin-bottom: 0.35rem;
}

.ui-callout-note {
  background: #ecfeff;
}

.ui-callout-warning {
  background: #fff7ed;
}

.ui-callout-example {
  background: #ecfdf5;
}

.ui-callout-issue {
  background: #fff1f2;
}

.ui-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.18rem 0.45rem;
  border-radius: 999px;
  font-size: 0.74rem;
  line-height: 1;
  border: 1px solid transparent;
  font-weight: 600;
}

.ui-badge-accent {
  background: #e6fffb;
  color: #0f766e;
  border-color: #94d2cc;
}

.ui-badge-neutral {
  background: #f1f5f9;
  color: #334155;
  border-color: #d3dce8;
}

.ui-badge-warn {
  background: #fff7ed;
  color: #9a3412;
  border-color: #fed7aa;
}

.ui-badge-danger {
  background: #fff1f2;
  color: #b91c1c;
  border-color: #fecdd3;
}

.mermaid-shell,
.likec4-shell {
  border: 1px solid var(--spec-line);
  border-radius: 12px;
  background: #f8fafc;
  padding: 0.7rem;
}

.likec4-shell {
  min-height: 360px;
}

@media (max-width: 980px) {
  .spec-layout {
    grid-template-columns: 1fr;
  }

  .toc {
    position: static;
    max-height: none;
  }

  .spec-meta-row {
    grid-template-columns: 1fr;
    gap: 0.25rem;
  }
}
`;
