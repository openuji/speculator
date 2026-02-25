import fs from "node:fs/promises";
import path from "node:path";
import {
  NodeFileProvider,
  SpeculatorPipeline,
  buildWorkspaces,
  corePlugins,
} from "@openuji/speculator";
import { buildSearchIndex } from "@openuji/speculator-search";
import { loadSpecEnv } from "./lib/spec-env.mjs";

const appRoot = process.cwd();

const workspaceConfigPath = path.join(appRoot, "speculator.workspace.json");
const outputPath = path.join(appRoot, "public", "search-index.json");

const resolveEntryMapPaths = (entryMap, baseDir) => {
  const resolved = {};

  for (const [workspaceKey, definition] of Object.entries(entryMap)) {
    if (typeof definition === "string") {
      resolved[workspaceKey] = path.resolve(baseDir, definition);
      continue;
    }

    resolved[workspaceKey] = definition.map((entry) => ({
      ...entry,
      entry: path.resolve(baseDir, entry.entry),
      configPath: entry.configPath ? path.resolve(baseDir, entry.configPath) : entry.configPath,
    }));
  }

  return resolved;
};

const main = async () => {
  const { env, baseUrl } = await loadSpecEnv(appRoot);
  const workspaceConfig = JSON.parse(await fs.readFile(workspaceConfigPath, "utf-8"));
  const entryMap = resolveEntryMapPaths(workspaceConfig, appRoot);

  const pipeline = new SpeculatorPipeline(corePlugins);
  const { workspaces, errors } = await buildWorkspaces({
    entryMap,
    fileProvider: new NodeFileProvider(),
    pipeline,
    env,
  });

  if (errors.length > 0) {
    console.warn("[search:build] Workspace build reported issues:");
    for (const error of errors) {
      console.warn(`  - ${error}`);
    }
  }

  const documents = [];

  for (const [workspaceKey, workspace] of Object.entries(workspaces)) {
    const routeByFile = new Map();

    for (const document of workspace.documents) {
      const sourceFile = document.sourcePos?.file;
      if (!sourceFile) continue;
      const docId = document.id || path.basename(path.dirname(sourceFile));
      routeByFile.set(sourceFile, {
        workspace: workspaceKey,
        docId,
        route: `/workspaces/${workspaceKey}/${docId}`,
        title: document.metadata?.title || docId,
      });
    }

    const { data } = await buildSearchIndex(workspace, { includeSourcePos: false });

    for (const docData of data.documents) {
      const routeInfo = routeByFile.get(docData.documentId);
      if (!routeInfo) {
        continue;
      }

      documents.push({
        documentId: docData.documentId,
        title: String(routeInfo.title || docData.title || routeInfo.docId),
        shortName: docData.shortName,
        workspace: routeInfo.workspace,
        docId: routeInfo.docId,
        route: routeInfo.route,
        entries: docData.entries,
      });
    }
  }

  const payload = {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    documents,
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");

  console.log(`[search:build] using SPEC_BASE_URL=${baseUrl}`);
  console.log(`[search:build] wrote ${documents.length} document indexes to ${outputPath}`);
};

main().catch((error) => {
  console.error("[search:build] failed:", error);
  process.exit(1);
});
