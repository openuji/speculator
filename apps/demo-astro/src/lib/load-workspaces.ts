import fs from "node:fs";
import path from "node:path";
import {
  NodeFileProvider,
  SpeculatorPipeline,
  buildWorkspaces,
  corePlugins,
  type Document,
  type Workspace,
  type WorkspaceEntryMap,
} from "@openuji/speculator";
import {
  SpeculatorLinter,
  builtInRules,
  recommendedConfig,
  type LintDiagnostic,
} from "@openuji/speculator-lint";
import { loadSpecEnv } from "./spec-env";

export interface WorkspaceDocumentView {
  workspaceKey: string;
  id: string;
  title: string;
  sourceFile: string;
  route: string;
  order: number;
  vocabModules: string[];
  document: Document;
  diagnostics: LintDiagnostic[];
  errorCount: number;
  warningCount: number;
}

export interface WorkspaceRuleSummary {
  code: string;
  count: number;
  errors: number;
  warnings: number;
}

export interface WorkspaceView {
  key: string;
  workspace: Workspace;
  documents: WorkspaceDocumentView[];
  diagnostics: LintDiagnostic[];
  ruleSummary: WorkspaceRuleSummary[];
  buildErrors: string[];
  errorCount: number;
  warningCount: number;
}

export interface LoadedWorkspaces {
  generatedAt: string;
  workspaces: WorkspaceView[];
  workspaceMap: Map<string, WorkspaceView>;
  documents: WorkspaceDocumentView[];
  getDocument: (
    workspaceKey: string,
    docId: string
  ) => WorkspaceDocumentView | undefined;
}

let cachedPromise: Promise<LoadedWorkspaces> | null = null;

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

const resolveAstroDemoRoot = (): string => {
  const cwd = process.cwd();

  const directApp = path.resolve(cwd, "apps/demo-astro");
  if (fs.existsSync(path.join(directApp, "package.json"))) {
    return directApp;
  }

  if (fs.existsSync(path.join(cwd, "package.json")) && cwd.endsWith("apps/demo-astro")) {
    return cwd;
  }

  const workspaceRoot = findWorkspaceRoot(cwd);
  if (workspaceRoot) {
    const appRoot = path.join(workspaceRoot, "apps/demo-astro");
    if (fs.existsSync(path.join(appRoot, "package.json"))) {
      return appRoot;
    }
  }

  throw new Error("Unable to resolve apps/demo-astro root.");
};

const resolveEntryMapPaths = (
  entryMap: WorkspaceEntryMap,
  appRoot: string
): WorkspaceEntryMap => {
  const resolved: WorkspaceEntryMap = {};

  for (const [workspaceKey, definition] of Object.entries(entryMap)) {
    if (typeof definition === "string") {
      resolved[workspaceKey] = path.resolve(appRoot, definition);
      continue;
    }

    resolved[workspaceKey] = definition.map((entry) => ({
      ...entry,
      entry: path.resolve(appRoot, entry.entry),
      configPath: entry.configPath ? path.resolve(appRoot, entry.configPath) : entry.configPath,
    }));
  }

  return resolved;
};

const groupBuildErrors = (errors: string[]): Map<string, string[]> => {
  const grouped = new Map<string, string[]>();

  for (const error of errors) {
    const match = error.match(/^\[([^\]]+)\]\s*(.*)$/);
    const workspaceKey = match?.[1] || "_global";
    const message = match?.[2] || error;

    const list = grouped.get(workspaceKey) || [];
    list.push(message);
    grouped.set(workspaceKey, list);
  }

  return grouped;
};

const buildRuleSummary = (diagnostics: LintDiagnostic[]): WorkspaceRuleSummary[] => {
  const table = new Map<string, WorkspaceRuleSummary>();

  for (const diagnostic of diagnostics) {
    const current =
      table.get(diagnostic.code) ||
      ({
        code: diagnostic.code,
        count: 0,
        errors: 0,
        warnings: 0,
      } as WorkspaceRuleSummary);

    current.count += 1;
    if (diagnostic.severity === "error") {
      current.errors += 1;
    }
    if (diagnostic.severity === "warning") {
      current.warnings += 1;
    }

    table.set(diagnostic.code, current);
  }

  return Array.from(table.values()).sort((left, right) => right.count - left.count);
};

const computeDocumentDiagnostics = (
  diagnostics: LintDiagnostic[],
  sourceFile: string
): LintDiagnostic[] => diagnostics.filter((diagnostic) => diagnostic.file === sourceFile);

const extractVocabModules = (document: Document): string[] => {
  const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
  const custom = metadata.custom && typeof metadata.custom === "object" ? metadata.custom : {};
  const rawModules = Array.isArray(custom.vocabModules) ? custom.vocabModules : [];

  const normalized = rawModules
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  if (!unique.includes("core")) {
    unique.unshift("core");
  }
  return unique;
};

const buildWorkspaceViews = async (): Promise<LoadedWorkspaces> => {
  const appRoot = resolveAstroDemoRoot();
  const workspaceConfigPath = path.join(appRoot, "speculator.workspace.json");

  if (!fs.existsSync(workspaceConfigPath)) {
    throw new Error(`Workspace config not found at ${workspaceConfigPath}`);
  }

  const rawConfig = JSON.parse(
    fs.readFileSync(workspaceConfigPath, "utf-8")
  ) as WorkspaceEntryMap;

  const entryMap = resolveEntryMapPaths(rawConfig, appRoot);

  const fileProvider = new NodeFileProvider();
  const pipeline = new SpeculatorPipeline(corePlugins);
  const linter = new SpeculatorLinter(builtInRules);
  const { env } = loadSpecEnv(appRoot);

  const buildResult = await buildWorkspaces({
    entryMap,
    fileProvider,
    pipeline,
    env,
  });

  const groupedBuildErrors = groupBuildErrors(buildResult.errors);

  const workspaces: WorkspaceView[] = [];

  for (const [workspaceKey, workspace] of Object.entries(buildResult.workspaces)) {
    const documentLevels = new Map<string, number>();
    workspace.documents.forEach((document, index) => {
      const sourceFile = document.sourcePos?.file;
      if (sourceFile) {
        documentLevels.set(sourceFile, index);
      }
    });

    const lintResult = await linter.lint({
      workspace,
      documentLevels,
      config: recommendedConfig,
    });

    const documents: WorkspaceDocumentView[] = workspace.documents.map((document, index) => {
      const docId = document.id || `${workspaceKey}-doc-${index + 1}`;
      const sourceFile = document.sourcePos?.file || "unknown";
      const title = String((document.metadata || {}).title || docId);
      const diagnostics = computeDocumentDiagnostics(lintResult.diagnostics, sourceFile);
      const errorCount = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
      const warningCount = diagnostics.filter(
        (diagnostic) => diagnostic.severity === "warning"
      ).length;

      return {
        workspaceKey,
        id: docId,
        title,
        sourceFile,
        route: `/workspaces/${workspaceKey}/${docId}`,
        order: index,
        vocabModules: extractVocabModules(document),
        document,
        diagnostics,
        errorCount,
        warningCount,
      };
    });

    const errorCount = lintResult.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error"
    ).length;
    const warningCount = lintResult.diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning"
    ).length;

    workspaces.push({
      key: workspaceKey,
      workspace,
      documents,
      diagnostics: lintResult.diagnostics,
      ruleSummary: buildRuleSummary(lintResult.diagnostics),
      buildErrors: groupedBuildErrors.get(workspaceKey) || [],
      errorCount,
      warningCount,
    });
  }

  const workspaceMap = new Map<string, WorkspaceView>(
    workspaces.map((workspace) => [workspace.key, workspace])
  );

  const documents = workspaces.flatMap((workspace) => workspace.documents);

  return {
    generatedAt: new Date().toISOString(),
    workspaces,
    workspaceMap,
    documents,
    getDocument: (workspaceKey: string, docId: string) =>
      workspaceMap.get(workspaceKey)?.documents.find((document) => document.id === docId),
  };
};

export const loadWorkspaces = async (): Promise<LoadedWorkspaces> => {
return buildWorkspaceViews();
};
