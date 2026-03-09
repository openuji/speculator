/**
 * End-to-end test: samples/oidc/index.bs
 *
 * Validates that the Solid-OIDC Bikeshed spec migrates correctly to
 * Speculator index.md + config.json.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate, type MigrationResult } from "../src/migrate.js";

const SAMPLES_DIR = resolve(
  fileURLToPath(import.meta.url),
  "../../samples/oidc",
);

let result: MigrationResult;

beforeAll(async () => {
  const content = await readFile(resolve(SAMPLES_DIR, "index.bs"), "utf-8");
  result = await migrate(content);
});

describe("oidc config.json", () => {
  it("has correct shortName", () => {
    expect(result.config.bikeshed!.shortname).toBe("solid-oidc");
  });

  it("has correct specStatus", () => {
    expect(result.config.bikeshed!.status).toBe("CG-DRAFT");
  });

  it("has thisVersion from ED field", () => {
    expect(result.config.bikeshed!.ed).toBe(
      "https://solid.github.io/solid-oidc/",
    );
  });

  it("has latestVersion from TR field", () => {
    expect(result.config.bikeshed!.tr).toBe("https://solidproject.org/TR/oidc");
  });

  it("has correct maxTocLevel", () => {
    expect(result.config.bikeshed!.maxtocdepth).toBe("2");
  });

  it("has editors array with correct count", () => {
    expect(result.config.bikeshed!.editor).toBeDefined();
    expect((result.config.bikeshed!.editor as any[]).length).toBe(3);
  });

  it("first editor contains correct markdown string", () => {
    const first = (result.config.bikeshed!.editor as string[])[0];
    expect(first.name).toContain("Aaron Coburn");
    expect(first.company).toContain("Inrupt");
  });

  it("has localBiblio with DPOP entry", () => {
    expect(result.config.bikeshed!.biblio).toBeDefined();
    expect((result.config.bikeshed!.biblio as any)!["DPOP"]).toBeDefined();
  });

  it("biblio DPOP entry uses url not href", () => {
    const dpop = (result.config.bikeshed!.biblio as any)!["DPOP"];
    expect(dpop.url).toBeDefined();
    expect(dpop.href).toBeUndefined();
  });

  it("has former editors", () => {
    expect(result.config.custom.formereditor).toBeDefined();
    expect(Array.isArray(result.config.custom.formereditor)).toBe(true);
  });

  it("has abstract", () => {
    expect(result.abstract).toBeDefined();
    expect(result.abstract!.length).toBeGreaterThan(20);
  });
});

describe("oidc index.md", () => {
  it('does not contain <pre class="metadata">', () => {
    expect(result.md).not.toMatch(/<pre\s+class=['"]metadata/);
  });

  it('does not contain <pre class="biblio">', () => {
    expect(result.md).not.toMatch(/<pre\s+class=['"]biblio/);
  });

  it('contains turtle code fence (from <pre highlight="turtle">)', () => {
    expect(result.md).toContain("```turtle");
  });

  it('contains http code fence (from <pre highlight="http">)', () => {
    expect(result.md).toContain("```http");
  });

  it("strips Bikeshed closing # and demotes ATX headings by one level", () => {
    expect(result.md).toContain("## Introduction {#intro}");
    expect(result.md).not.toContain("# Introduction #");
    // Use line-anchored regex: '## Introduction {#intro}' contains '# Introduction {#intro}' as substring
    expect(result.md).not.toMatch(/^# Introduction/m);
  });

  it("preserves [[!RFC6749]] citation syntax", () => {
    expect(result.md).toContain("[[!RFC6749]]");
  });

  it("preserves Issue(N): markers", () => {
    expect(result.md).toContain("Issue(");
  });

  it("preserves HTML passthrough elements", () => {
    expect(result.md).toContain("<dl>");
    expect(result.md).toContain("<figure");
  });

  it('preserves <figure class="example"> wrapper with code fence inside', () => {
    expect(result.md).toContain('<figure class="example">');
    // Code fence should be inside the wrapper, not hoisted out
    expect(result.md).toMatch(
      /<figure class="example">[\s\S]*?```[\s\S]*?```[\s\S]*?<\/figure>/,
    );
  });

  it('preserves <div class="example"> wrapper with code fence inside', () => {
    expect(result.md).toContain('<div class="example">');
    expect(result.md).toMatch(
      /<div class="example">[\s\S]*?```[\s\S]*?```[\s\S]*?<\/div>/,
    );
  });
});

describe("oidc legacy path smoke test", () => {
  it("returns markdown and config payloads", () => {
    expect(result.md.length).toBeGreaterThan(0);
    expect(result.config).toBeDefined();
  });
});
