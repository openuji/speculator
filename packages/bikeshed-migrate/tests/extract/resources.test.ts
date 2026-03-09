import { describe, expect, it } from "vitest";
import { extractResources } from "../../src/extract/resources.js";

describe("extractResources", () => {
  it("extracts <style> and <script> blocks in source order", () => {
    const source = `
<style>.a { color: red; }</style>
<p>keep me</p>
<script>console.log('x')</script>
`;

    const { resources, rest } = extractResources(source);

    expect(resources).toEqual([
      { type: "style", content: ".a { color: red; }" },
      { type: "script", content: "console.log('x')" },
    ]);
    expect(rest).toContain("<p>keep me</p>");
    expect(rest).not.toContain("<style>");
    expect(rest).not.toContain("<script>");
  });
});
