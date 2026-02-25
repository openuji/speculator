import { describe, it, expect } from 'vitest';
import { MarkdownUnitParser } from '../index.js';
import '../../html/index.js'; 
import { assembleDocument } from '../../assembler.js';

describe('Granular Markdown Parser Tests', () => {


//     it('demonstrates raw remark parsing vs preprocessed parsing', async () => {
//         const markdown = `## The Universal Node {#node data-cop-concept="node"}
// <dfn>Some Definition</dfn> means some \`very\` specific
// <spec-statement id="stmt1">This definition **MUST** be clear</spec-statement>
// - test
// `;

//       const test =  `
// <spec-statement>[=Node|Nodes=] **MAY** include additional properties beyond \`@type\`, \`@id\`, meta, and extensions.
// </spec-statement>
// `




//         // How the raw processor handles it
//         //const rawAst = processor.parse(markdown);
//         const processor = unified()
//             .use(remarkParse)
//             .use(remarkGfm)
//             .use(remarkMdxAgnostic)        // enables JSX/expressions without JS validation
//             .use(remarkHeadingAttrBlocks); // your transformer
//         // With normalization (Fixing the MDX phrasing issue)
//         const normalized = normalizeMdxTags(test);
//         const normalTree = processor.parse(normalized);
//         const normalAst = await processor.run(normalTree);
        
//         // Run `pnpm vitest run src/parse/markdown/__tests__/parser-granular.test.ts -u` 
//         // to update snapshots and visually inspect the AST differences
//         expect(normalAst).toMatchSnapshot();
//         //expect(processedAst).toMatchSnapshot();
//     });

//     it("test speculator ast", () => {
//         const testMarkdown = `
// <spec-statement>

// [=Node|Nodes=] **MAY** include additional properties beyond \`@type\`, \`@id\`, meta, and extensions.

// </spec-statement>
// `;
//         const parser = new MarkdownUnitParser();
//         const units = [{
//             file: 'test.md',
//             format: 'markdown' as const,
//             content: testMarkdown,
//             startLine: 1
//         }];
//         const blocks = parser.parse(units[0]);
//         const doc = assembleDocument(blocks, { id: 'test-spec', deps: [], specIri: 'https://example.org/test' }, 'test.md');

//         expect(doc).toMatchSnapshot();
//     });

    it("shows project own ast with inline-like statement", () => {
      const parser = new MarkdownUnitParser();
      const unit = {
            file: 'test.md',
            format: 'markdown' as const,
            content: `\n
            <dfn>Some Definition</dfn> means some \`very\` specific
            <spec-statement id="stmt1">This is a **normative** statement</spec-statement>\n
            \n`,
            startLine: 1,
        };
        const blocks = parser.parse(unit);
        const doc = assembleDocument(blocks, { id: 'test-inline', deps: [], specIri: 'https://example.org/inline' }, 'test.md');
        expect(doc).toMatchSnapshot();
    });
});
