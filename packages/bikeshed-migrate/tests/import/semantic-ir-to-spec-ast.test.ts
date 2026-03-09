import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { mapSemanticIrToSpecAst } from "../../src/import/map-semantic-ir-to-spec-ast.js";
import type { DocumentNode } from "../../src/import/semantic-ir.js";
import type { SpeculatorConfig } from "../../src/build-config.js";

async function readJson<T>(path: string): Promise<T> {
  const content = await readFile(new URL(path, import.meta.url), "utf8");
  return JSON.parse(content) as T;
}

function walkNodes(
  value: unknown,
  visitor: (node: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    for (const item of value) walkNodes(item, visitor);
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  visitor(record);

  for (const child of Object.values(record)) {
    walkNodes(child, visitor);
  }
}

function findSectionByBoilerplate(
  document: { children: unknown[] },
  boilerplate: "abstract" | "sotd" | "conformance",
): Record<string, unknown> | undefined {
  return document.children.find(
    (child): child is Record<string, unknown> =>
      !!child &&
      typeof child === "object" &&
      (child as { type?: string }).type === "section" &&
      (child as { boilerplate?: string }).boilerplate === boilerplate,
  );
}

describe("mapSemanticIrToSpecAst", () => {
  it("maps webmcp semantic IR and config to speculator AST preserving boilerplate and rich IDL/code semantics", async () => {
    const ir = await readJson<DocumentNode>(
      "../../samples/webmcp/semantic-ir.json",
    );
    const config = await readJson<SpeculatorConfig>(
      "../../samples/webmcp/config.json",
    );
    const sourcePath = "/virtual/webmcp/index.bs";

    const result = mapSemanticIrToSpecAst({ ir, config, sourcePath });

    expect(result.workspace).toMatchSnapshot("webmcp-workspace");
    expect(result.config).toMatchSnapshot("webmcp-config");
    expect(result.diagnostics).toMatchSnapshot("webmcp-diagnostics");

    const document = result.workspace.documents[0];
    const conformance = findSectionByBoilerplate(document, "conformance");
    expect(conformance).toBeTruthy();
    expect(conformance?.omitted).toBe(true);

    const introSection = document.children.find(
      (child): child is { type: string; id?: string; number?: string } =>
        !!child &&
        typeof child === "object" &&
        (child as { type?: string }).type === "section" &&
        (child as { id?: string }).id === "intro",
    );
    expect(introSection?.number).toBe("1");

    let hasRichInlineCodeReference = false;
    let hasIdlChildren = false;
    let hasDefinitionList = false;
    let hasAlgorithm = false;
    let hasDomIntro = false;
    let hasNormativeRfc2119Cite = false;

    walkNodes(document, (node) => {
      if (
        node.type === "inlineCode" &&
        Array.isArray(node.children) &&
        node.children.some(
          (child) =>
            typeof child === "object" &&
            child !== null &&
            [
              "workspaceIdlReference",
              "externalIdlReference",
              "workspaceDfnReference",
              "externalDfnReference",
            ].includes((child as { type?: string }).type ?? ""),
        )
      ) {
        hasRichInlineCodeReference = true;
      }

      if (
        node.type === "idl" &&
        Array.isArray(node.children) &&
        node.children.length > 0
      ) {
        hasIdlChildren = true;
      }

      if (node.type === "definitionList") hasDefinitionList = true;
      if (node.type === "algorithm") hasAlgorithm = true;
      if (node.type === "domIntro") hasDomIntro = true;

      if (
        node.type === "cite" &&
        node.key === "RFC2119" &&
        (node.kind === "normative" || node.forcedNormative === true)
      ) {
        hasNormativeRfc2119Cite = true;
      }
    });

    expect(hasRichInlineCodeReference).toBe(true);
    expect(hasIdlChildren).toBe(true);
    expect(hasDefinitionList).toBe(true);
    expect(hasAlgorithm).toBe(true);
    expect(hasDomIntro).toBe(true);
    expect(hasNormativeRfc2119Cite).toBe(true);
  });

  it("maps oidc semantic IR to figure/image asset nodes with mermaid source metadata intact", async () => {
    const ir = await readJson<DocumentNode>(
      "../../samples/oidc/semantic-ir.json",
    );
    const config = await readJson<SpeculatorConfig>(
      "../../samples/oidc/config.json",
    );
    const sourcePath = "/virtual/oidc/index.bs";

    const result = mapSemanticIrToSpecAst({ ir, config, sourcePath });

    expect(result.workspace).toMatchSnapshot("oidc-workspace");
    expect(result.config).toMatchSnapshot("oidc-config");
    expect(result.diagnostics).toMatchSnapshot("oidc-diagnostics");

    let figureWithMermaidAssetFound = false;
    walkNodes(result.workspace, (node) => {
      if (node.type !== "figure") return;
      const image = node.image as Record<string, unknown> | undefined;
      if (!image) return;

      if (
        image.srcOriginal === "sequence.mmd.svg" &&
        image.srcResolved === "sequence.mmd" &&
        image.generatedFrom === "mermaid-mmd"
      ) {
        figureWithMermaidAssetFound = true;
      }
    });

    expect(figureWithMermaidAssetFound).toBe(true);
  });

  it("emits diagnostics and falls back to link node for non-inferable external dfn/idl references", () => {
    const ir: DocumentNode = {
      type: "Document",
      children: [
        {
          type: "Paragraph",
          children: [
            {
              type: "LinkRef",
              kind: "dfn",
              href: "https://example.com/non-spec#term",
              children: [{ type: "Text", value: "Term" }],
            },
            { type: "Text", value: " and " },
            {
              type: "LinkRef",
              kind: "idl",
              href: "https://example.com/non-spec#Interface",
              children: [{ type: "Text", value: "Interface" }],
            },
          ],
        },
      ],
    };

    const config: SpeculatorConfig = {
      bikeshed: {
        shortname: "test-spec",
        title: "Test Spec",
      },
      custom: {},
    };

    const result = mapSemanticIrToSpecAst({
      ir,
      config,
      sourcePath: "/virtual/test/index.bs",
    });

    const links: Record<string, unknown>[] = [];
    walkNodes(result.workspace, (node) => {
      if (node.type === "link") links.push(node);
    });

    expect(links.length).toBe(2);
    expect(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === "EXTERNAL_REFERENCE_SPEC_UNKNOWN",
      ),
    ).toBe(true);
  });
});
