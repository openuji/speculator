import { beforeAll, describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importBikeshedSpec } from "../src/import-bikeshed-spec.js";
import type { BikeshedRenderer } from "../src/renderer/types.js";
import type {
  DocumentNode,
  FigureBlockNode,
  ImageAssetNode,
  ImageInlineNode,
  SemanticBlockNode,
  SemanticInlineNode,
  SectionNode,
} from "../src/import/semantic-ir.js";

const PACKAGE_ROOT = resolve(fileURLToPath(import.meta.url), "..", "..");
const OIDC_SOURCE = resolve(PACKAGE_ROOT, "samples/oidc/index.bs");

const SOURCE_BS = `<pre class='metadata'>
Title: Asset Resolution
Shortname: asset-resolution
Status: CG-DRAFT
Group: webml
</pre>
`;

const RENDERED_HTML = `<!doctype html>
<html lang="en">
<body>
  <main id="main">
    <section id="basic-flow">
      <h2 id="basic-flow-heading">Basic Flow</h2>
      <figure id="fig-signature">
        <img src="sequence.mmd.svg" alt="Sequence diagram">
        <figcaption>Basic sequence of authenticating the user and the client.</figcaption>
      </figure>
      <p>Inline image <img src="sequence.mmd?inline=1#sample" alt="Inline sequence"> should be preserved.</p>
      <img src="sequence.mmd" alt="Standalone local">
      <img src="missing.mmd.svg" alt="Missing local">
      <img src="https://example.com/logo.png" alt="External logo">
    </section>
  </main>
</body>
</html>`;

let result: Awaited<ReturnType<typeof importBikeshedSpec>>;

beforeAll(async () => {
  const renderer: BikeshedRenderer = {
    async render() {
      return {
        html: RENDERED_HTML,
        logs: ["fixture renderer used"],
        diagnostics: [],
      };
    },
  };

  result = await importBikeshedSpec(SOURCE_BS, {
    renderer,
    resolveBoilerplate: false,
    sourcePath: OIDC_SOURCE,
  });
});

describe("semantic image asset import + resolution", () => {
  it("imports figure image with Mermaid source resolution", () => {
    const figure = findBlock(
      result.document,
      (node): node is FigureBlockNode =>
        node.type === "FigureBlock" && node.id === "fig-signature",
    );

    expect(figure).toBeDefined();
    expect(figure?.image).toEqual({
      type: "ImageAsset",
      srcOriginal: "sequence.mmd.svg",
      srcResolved: "sequence.mmd",
      alt: "Sequence diagram",
      title: undefined,
      exists: true,
      generatedFrom: "mermaid-mmd",
    });
    expect(inlineText(figure?.caption ?? [])).toContain(
      "Basic sequence of authenticating the user and the client.",
    );
  });

  it("retains missing Mermaid asset and emits warning diagnostic", () => {
    const missing = findBlock(
      result.document,
      (node): node is ImageAssetNode =>
        node.type === "ImageAsset" && node.srcOriginal === "missing.mmd.svg",
    );

    expect(missing).toBeDefined();
    expect(missing?.srcResolved).toBe("missing.mmd");
    expect(missing?.generatedFrom).toBe("mermaid-mmd");
    expect(missing?.exists).toBe(false);
    expect(
      result.diagnostics.some(
        (diagnostic) =>
          diagnostic.stage === "import" &&
          diagnostic.code === "ASSET_SOURCE_MISSING" &&
          diagnostic.message.includes("missing.mmd"),
      ),
    ).toBe(true);
  });

  it("preserves non-mermaid local and external images without forced remapping", () => {
    const local = findBlock(
      result.document,
      (node): node is ImageAssetNode =>
        node.type === "ImageAsset" && node.srcOriginal === "sequence.mmd",
    );
    const external = findBlock(
      result.document,
      (node): node is ImageAssetNode =>
        node.type === "ImageAsset" &&
        node.srcOriginal === "https://example.com/logo.png",
    );
    const inlineImage = findInline(
      result.document,
      (node): node is ImageInlineNode =>
        node.type === "ImageInline" &&
        node.asset.srcOriginal === "sequence.mmd?inline=1#sample",
    );

    expect(local).toBeDefined();
    expect(local?.srcResolved).toBe("sequence.mmd");
    expect(local?.exists).toBe(true);
    expect(local?.generatedFrom).toBeUndefined();

    expect(external).toBeDefined();
    expect(external?.srcResolved).toBeUndefined();
    expect(external?.exists).toBeUndefined();
    expect(external?.generatedFrom).toBeUndefined();

    expect(inlineImage).toBeDefined();
    expect(inlineImage?.asset.srcResolved).toBe("sequence.mmd");
    expect(inlineImage?.asset.exists).toBe(true);
    expect(inlineImage?.asset.generatedFrom).toBeUndefined();
  });
});

function findBlock<T extends SemanticBlockNode>(
  document: DocumentNode,
  predicate: (node: SemanticBlockNode) => node is T,
): T | undefined {
  const stack: SemanticBlockNode[] = [];
  for (const child of document.children) {
    stack.push(child as SemanticBlockNode);
  }

  while (stack.length > 0) {
    const node = stack.pop() as SemanticBlockNode;
    if (predicate(node)) return node;

    if (node.type === "Section") {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
      continue;
    }

    if (
      node.type === "AlgorithmBlock" ||
      node.type === "DomIntroBlock" ||
      node.type === "NoteBlock" ||
      node.type === "FigureBlock"
    ) {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
      continue;
    }

    if (node.type === "DefinitionList") {
      for (const item of node.items) {
        for (let i = item.description.length - 1; i >= 0; i--) {
          stack.push(item.description[i]);
        }
      }
      continue;
    }

    if (node.type === "List") {
      for (const item of node.items) {
        for (let i = item.children.length - 1; i >= 0; i--) {
          stack.push(item.children[i]);
        }
      }
      continue;
    }

    if (node.type === "ListItem") {
      for (let i = node.children.length - 1; i >= 0; i--) {
        stack.push(node.children[i]);
      }
    }
  }

  return undefined;
}

function findInline<T extends SemanticInlineNode>(
  document: DocumentNode,
  predicate: (node: SemanticInlineNode) => node is T,
): T | undefined {
  const visitInline = (inline: SemanticInlineNode): T | undefined => {
    if (predicate(inline)) return inline;
    if (inline.type === "Definition" || inline.type === "LinkRef") {
      for (const child of inline.children) {
        const found = visitInline(child);
        if (found) return found;
      }
    }
    return undefined;
  };

  const visitBlock = (block: SemanticBlockNode): T | undefined => {
    if (block.type === "Paragraph") {
      for (const inline of block.children) {
        const found = visitInline(inline);
        if (found) return found;
      }
      return undefined;
    }

    if (block.type === "Section") {
      for (const inline of block.heading) {
        const found = visitInline(inline);
        if (found) return found;
      }
      for (const child of block.children) {
        const found = visitBlock(child);
        if (found) return found;
      }
      return undefined;
    }

    if (
      block.type === "AlgorithmBlock" ||
      block.type === "DomIntroBlock" ||
      block.type === "NoteBlock" ||
      block.type === "FigureBlock"
    ) {
      if (block.type === "FigureBlock") {
        for (const inline of block.caption) {
          const found = visitInline(inline);
          if (found) return found;
        }
      }
      for (const child of block.children) {
        const found = visitBlock(child);
        if (found) return found;
      }
      return undefined;
    }

    if (block.type === "DefinitionList") {
      for (const item of block.items) {
        for (const inline of item.term) {
          const found = visitInline(inline);
          if (found) return found;
        }
        for (const description of item.description) {
          const found = visitBlock(description);
          if (found) return found;
        }
      }
      return undefined;
    }

    if (block.type === "List") {
      for (const item of block.items) {
        for (const child of item.children) {
          const found = visitBlock(child);
          if (found) return found;
        }
      }
      return undefined;
    }

    if (block.type === "ListItem") {
      for (const child of block.children) {
        const found = visitBlock(child);
        if (found) return found;
      }
    }

    return undefined;
  };

  for (const child of document.children) {
    const found = visitBlock(child as SectionNode);
    if (found) return found;
  }
  return undefined;
}

function inlineText(nodes: SemanticInlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "Text") return node.value;
      if (node.type === "CodeSpan") return node.value;
      if (node.type === "Variable") return node.value;
      if (node.type === "Definition" || node.type === "LinkRef") {
        return inlineText(node.children);
      }
      return "";
    })
    .join("");
}
