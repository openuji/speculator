import fs from "node:fs";
import path from "node:path";
import {
  NodeFileProvider,
  corePlugins,
  speculate,
  type Document,
  type TocEntry,
} from "@openuji/speculator";

export interface LoadedSpec {
  document: Document;
  toc: TocEntry[];
  headingNumbers: Record<string, string | undefined>;
  statementsJsonLd: unknown;
}

const findWorkspaceRoot = (start: string): string | undefined => {
  let current = start;

  while (true) {
    if (fs.existsSync(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
};

const resolveSpecDirectory = (): string => {
  const cwd = process.cwd();
  const workspaceRoot = findWorkspaceRoot(cwd);

  const candidates = [
    path.resolve(cwd, "src/spec"),
    path.resolve(cwd, "../astro-demo/src/spec"),
    workspaceRoot ? path.resolve(workspaceRoot, "apps/astro-demo/src/spec") : "",
  ].filter(Boolean);

  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Could not locate demo spec source. Checked: ${candidates.join(", ")}`,
    );
  }

  return found;
};

export const loadDemoSpec = async (): Promise<LoadedSpec> => {
  const specDirectory = resolveSpecDirectory();
  const entryPath = path.join(specDirectory, "index.md");
  const configPath = path.join(specDirectory, "config.json");

  const result = await speculate({
    entry: entryPath,
    configPath,
    plugins: corePlugins,
    fileProvider: new NodeFileProvider(),
  });

  const document = result.workspace?.documents[0];
  if (!document) {
    throw new Error("Speculator did not return a document for the playground source.");
  }

  return {
    document,
    toc: document.computed?.toc || [],
    headingNumbers: document.computed?.headingNumbers || {},
    statementsJsonLd: document.computed?.statementsJsonLd,
  };
};
