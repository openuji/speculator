import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  MemoryFileProvider,
  corePlugins,
  speculate,
  type Document,
  type Inline,
  type SpecConfig,
} from "@openuji/speculator";
import {
  mapSemanticIrToSpecAst,
  type DocumentNode,
  type SpeculatorConfig,
} from "@openuji/bikeshed-migrate";
import { emitSpecPackage } from "../src/emit-spec-package.js";

interface SemanticProjection {
  definitions: string[];
  references: string[];
  cites: string[];
  idlBlocks: Array<{
    value: string;
    definitions: string[];
    references: string[];
    cites: string[];
  }>;
}

const REF_TYPES = new Set([
  "workspaceDfnReference",
  "workspaceIdlReference",
  "workspaceElementReference",
  "externalDfnReference",
  "externalIdlReference",
  "externalElementReference",
]);

function normalizeKey(value: string): string {
  return value.toLowerCase();
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function definitionSignature(node: {
  term: string;
  dfnType?: string;
  forContexts?: (string | null)[];
}): string {
  const forContexts = (node.forContexts ?? [])
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    )
    .join(",");
  return `${node.term}|${node.dfnType ?? ""}|${forContexts}`;
}

function referenceSignature(node: {
  type: string;
  targetTerm: string;
  xrefSpec?: string;
  forContexts?: (string | null)[];
}): string {
  const forContexts = (node.forContexts ?? [])
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0,
    )
    .join(",");
  return `${node.type}|${node.targetTerm}|${node.xrefSpec ?? ""}|${forContexts}`;
}

function citeSignature(node: {
  key: string;
  kind?: string;
  forcedNormative?: boolean;
  forcedInformative?: boolean;
  specId?: string | null;
  path?: string | null;
  fragment?: string | null;
}): string {
  return [
    node.key,
    node.kind ?? "",
    node.forcedNormative ? "1" : "0",
    node.forcedInformative ? "1" : "0",
    node.specId ?? "",
    node.path ?? "",
    node.fragment ?? "",
  ].join("|");
}

function projectInlineNodes(nodes: Inline[]): {
  definitions: string[];
  references: string[];
  cites: string[];
} {
  const definitions: string[] = [];
  const references: string[] = [];
  const cites: string[] = [];

  const walkInline = (node: Inline): void => {
    if (node.type === "definition") {
      definitions.push(definitionSignature(node));
    } else if (REF_TYPES.has(node.type)) {
      references.push(
        referenceSignature(
          node as {
            type: string;
            targetTerm: string;
            xrefSpec?: string;
            forContexts?: (string | null)[];
          },
        ),
      );
    } else if (node.type === "cite") {
      cites.push(citeSignature(node));
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children as Inline[]) {
        walkInline(child);
      }
    }
  };

  for (const node of nodes) {
    walkInline(node);
  }

  definitions.sort();
  references.sort();
  cites.sort();

  return { definitions, references, cites };
}

function projectDocument(document: Document): SemanticProjection {
  const definitions: string[] = [];
  const references: string[] = [];
  const cites: string[] = [];
  const idlBlocks: SemanticProjection["idlBlocks"] = [];

  const walkNode = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const item of value) walkNode(item);
      return;
    }

    if (!value || typeof value !== "object") return;

    const node = value as Record<string, unknown>;
    const type = node.type;

    if (type === "definition") {
      definitions.push(
        definitionSignature(
          node as {
            term: string;
            dfnType?: string;
            forContexts?: (string | null)[];
          },
        ),
      );
    } else if (typeof type === "string" && REF_TYPES.has(type)) {
      references.push(
        referenceSignature(
          node as {
            type: string;
            targetTerm: string;
            xrefSpec?: string;
            forContexts?: (string | null)[];
          },
        ),
      );
    } else if (type === "cite") {
      cites.push(
        citeSignature(
          node as {
            key: string;
            kind?: string;
            forcedNormative?: boolean;
            forcedInformative?: boolean;
            specId?: string | null;
            path?: string | null;
            fragment?: string | null;
          },
        ),
      );
    } else if (type === "idl") {
      const idlNode = node as { value: string; children: Inline[] };
      const projectedChildren = projectInlineNodes(idlNode.children ?? []);
      idlBlocks.push({
        value: normalizeWhitespace(idlNode.value),
        definitions: projectedChildren.definitions,
        references: projectedChildren.references,
        cites: projectedChildren.cites,
      });
    }

    for (const child of Object.values(node)) {
      walkNode(child);
    }
  };

  walkNode(document);

  definitions.sort();
  references.sort();
  cites.sort();
  idlBlocks.sort((a, b) => a.value.localeCompare(b.value));

  return { definitions, references, cites, idlBlocks };
}

function countMatching(values: string[], needle: string): number {
  return values.filter((value) => value.includes(needle)).length;
}

function citeKeySet(values: string[]): Set<string> {
  const keys = values
    .map((value) => value.split("|")[0])
    .map((key) => normalizeKey(key));
  return new Set(keys);
}

function dfnTerms(values: string[]): Set<string> {
  const terms = values
    .map((value) => value.split("|"))
    .filter((parts) => (parts[1] || "dfn") === "dfn")
    .map((parts) => normalizeKey(parts[0]));
  return new Set(terms);
}

function expectSemanticFidelity(
  source: SemanticProjection,
  parsed: SemanticProjection,
): void {
  const sourceCites = citeKeySet(source.cites);
  const parsedCites = citeKeySet(parsed.cites);
  expect(parsedCites).toEqual(sourceCites);

  const sourceNormativeCites = source.cites
    .filter((value) => {
      const parts = value.split("|");
      return parts[1] === "normative" || parts[2] === "1";
    })
    .map((value) => normalizeKey(value.split("|")[0]));
  const parsedNormativeCites = new Set(
    parsed.cites
      .filter((value) => {
        const parts = value.split("|");
        return parts[1] === "normative" || parts[2] === "1";
      })
      .map((value) => normalizeKey(value.split("|")[0])),
  );
  for (const citeKey of sourceNormativeCites) {
    expect(parsedNormativeCites.has(citeKey)).toBe(true);
  }

  const sourceDfnTerms = dfnTerms(source.definitions);
  const parsedDfnTerms = dfnTerms(parsed.definitions);
  for (const term of sourceDfnTerms) {
    expect(parsedDfnTerms.has(term)).toBe(true);
  }

  const sourceHasDfnRefs = countMatching(source.references, "DfnReference") > 0;
  const sourceHasIdlRefs = countMatching(source.references, "IdlReference") > 0;
  const sourceHasExternalIdlRefs =
    countMatching(source.references, "externalIdlReference") > 0;

  if (sourceHasDfnRefs) {
    expect(countMatching(parsed.references, "DfnReference")).toBeGreaterThan(0);
  }
  if (sourceHasIdlRefs) {
    expect(countMatching(parsed.references, "IdlReference")).toBeGreaterThan(0);
  }
  if (sourceHasExternalIdlRefs) {
    expect(
      countMatching(parsed.references, "externalIdlReference"),
    ).toBeGreaterThan(0);
  }

  expect(parsed.idlBlocks.length).toBe(source.idlBlocks.length);

  const sourceIdlWithReferences = source.idlBlocks.filter(
    (block) => block.references.length > 0,
  ).length;
  const parsedIdlWithReferences = parsed.idlBlocks.filter(
    (block) => block.references.length > 0,
  ).length;
  expect(parsedIdlWithReferences).toBeGreaterThanOrEqual(
    sourceIdlWithReferences,
  );
}

async function readJson<T>(url: URL): Promise<T> {
  const text = await readFile(url, "utf-8");
  return JSON.parse(text) as T;
}

async function runFixtureRoundtrip(sampleName: "webmcp" | "oidc"): Promise<{
  emittedDiagnostics: ReturnType<typeof emitSpecPackage>["diagnostics"];
  sourceProjection: SemanticProjection;
  parsedProjection: SemanticProjection;
}> {
  const semanticIr = await readJson<DocumentNode>(
    new URL(
      `../../bikeshed-migrate/samples/${sampleName}/semantic-ir.json`,
      import.meta.url,
    ),
  );
  const bikeshedConfig = await readJson<SpeculatorConfig>(
    new URL(
      `../../bikeshed-migrate/samples/${sampleName}/config.json`,
      import.meta.url,
    ),
  );

  const mapped = mapSemanticIrToSpecAst({
    ir: semanticIr,
    config: bikeshedConfig,
    sourcePath: `/virtual/${sampleName}/index.bs`,
  });

  const emitted = emitSpecPackage({
    workspace: mapped.workspace,
    config: mapped.config as SpecConfig,
  });

  const fp = new MemoryFileProvider({
    "/spec/index.md": emitted.indexMd,
    "/spec/config.json": emitted.configJson,
  });

  const result = await speculate({
    entry: "/spec/index.md",
    configPath: "/spec/config.json",
    fileProvider: fp,
    plugins: corePlugins,
  });

  if (result.errors && result.errors.length > 0) {
    throw new Error(result.errors.join("\n"));
  }

  const parsedDoc = result.workspace?.documents[0];
  if (!parsedDoc) {
    throw new Error("speculate() returned no parsed document");
  }

  const sourceDoc = mapped.workspace.documents[0];

  return {
    emittedDiagnostics: emitted.diagnostics,
    sourceProjection: projectDocument(sourceDoc),
    parsedProjection: projectDocument(parsedDoc),
  };
}

describe("semantic round-trip (emit -> speculate)", () => {
  it("preserves idl/dfn/ref/cite projections for webmcp", async () => {
    const roundtrip = await runFixtureRoundtrip("webmcp");

    expect(roundtrip.emittedDiagnostics).toMatchSnapshot(
      "webmcp-emitter-diagnostics",
    );
    expect(roundtrip.sourceProjection).toMatchSnapshot(
      "webmcp-source-projection",
    );
    expect(roundtrip.parsedProjection).toMatchSnapshot(
      "webmcp-parsed-projection",
    );
    expectSemanticFidelity(
      roundtrip.sourceProjection,
      roundtrip.parsedProjection,
    );
  });

  it("preserves idl/dfn/ref/cite projections for oidc", async () => {
    const roundtrip = await runFixtureRoundtrip("oidc");

    expect(roundtrip.emittedDiagnostics).toMatchSnapshot(
      "oidc-emitter-diagnostics",
    );
    expect(roundtrip.sourceProjection).toMatchSnapshot(
      "oidc-source-projection",
    );
    expect(roundtrip.parsedProjection).toMatchSnapshot(
      "oidc-parsed-projection",
    );
    expectSemanticFidelity(
      roundtrip.sourceProjection,
      roundtrip.parsedProjection,
    );
  });
});
