#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import {
  isWorkspace,
  type SpecConfig,
  type SpeculatorASTSchema,
} from "@openuji/speculator";
import {
  mapSemanticIrToSpecAst,
  type DocumentNode,
  type SpeculatorConfig,
} from "@openuji/bikeshed-migrate";
import { emitSpecPackage } from "./emit-spec-package.js";
import { writeSpecPackage } from "./write-spec-package.js";

interface ParsedArgs {
  workspacePath?: string;
  configPath?: string;
  semanticIrPath?: string;
  bikeshedConfigPath?: string;
  sourcePath?: string;
  workspaceOutPath?: string;
  outDir?: string;
  documentId?: string;
  dryRun: boolean;
  help: boolean;
}

function printUsage(): void {
  console.log(
    `
Usage: speculator-emit --workspace <workspace.json> --config <config.json> [options]
   or: speculator-emit --semantic-ir <semantic-ir.json> --bikeshed-config <config.json> [options]

Options:
  --workspace <path>   Path to workspace AST JSON
  --config <path>      Path to canonical SpecConfig JSON
  --semantic-ir <path> Path to bikeshed-migrate semantic-ir.json
  --bikeshed-config <path> Path to bikeshed-migrate config.json
  --source-path <path> Optional source index.bs path for diagnostics/sourcePos
  --workspace-out <path> Output workspace AST path (default: <out>/workspace.json)
  --out <dir>          Output directory (default: current working directory)
  --document-id <id>   Document id to emit (default: first document)
  --dry-run            Print index.md/config.json instead of writing files
  --help               Show this help message
`.trim(),
  );
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    dryRun: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case "--workspace":
        args.workspacePath = argv[++index];
        break;
      case "--config":
        args.configPath = argv[++index];
        break;
      case "--semantic-ir":
        args.semanticIrPath = argv[++index];
        break;
      case "--bikeshed-config":
        args.bikeshedConfigPath = argv[++index];
        break;
      case "--source-path":
        args.sourcePath = argv[++index];
        break;
      case "--workspace-out":
        args.workspaceOutPath = argv[++index];
        break;
      case "--out":
        args.outDir = argv[++index];
        break;
      case "--document-id":
        args.documentId = argv[++index];
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--help":
      case "-h":
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

async function readJson<T>(path: string): Promise<T> {
  const content = await readFile(path, "utf-8");
  return JSON.parse(content) as T;
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const outDir = resolve(args.outDir ?? process.cwd());
  const useMappedMode = !!args.semanticIrPath || !!args.bikeshedConfigPath;

  let workspace: SpeculatorASTSchema;
  let config: SpecConfig;
  const mapperWarnings: string[] = [];

  if (useMappedMode) {
    if (!args.semanticIrPath || !args.bikeshedConfigPath) {
      throw new Error(
        "Both --semantic-ir and --bikeshed-config are required in mapped mode.",
      );
    }

    const semanticIrPath = resolve(args.semanticIrPath);
    const bikeshedConfigPath = resolve(args.bikeshedConfigPath);
    const semanticIr = await readJson<DocumentNode>(semanticIrPath);
    const bikeshedConfig = await readJson<SpeculatorConfig>(bikeshedConfigPath);
    const mapped = mapSemanticIrToSpecAst({
      ir: semanticIr,
      config: bikeshedConfig,
      sourcePath: args.sourcePath ? resolve(args.sourcePath) : undefined,
    });

    workspace = mapped.workspace;
    config = mapped.config;
    for (const diagnostic of mapped.diagnostics) {
      mapperWarnings.push(
        `[${diagnostic.level}] ${diagnostic.code}: ${diagnostic.message}${diagnostic.path ? ` (${diagnostic.path})` : ""}`,
      );
    }
  } else {
    if (!args.workspacePath || !args.configPath) {
      printUsage();
      process.exitCode = 1;
      return;
    }

    const workspacePath = resolve(args.workspacePath);
    const configPath = resolve(args.configPath);
    workspace = await readJson<SpeculatorASTSchema>(workspacePath);
    if (!isWorkspace(workspace)) {
      throw new Error(`Invalid workspace AST at ${workspacePath}`);
    }

    config = await readJson<SpecConfig>(configPath);
  }

  if (args.dryRun) {
    const emitted = emitSpecPackage({
      workspace,
      config,
      documentId: args.documentId,
    });

    console.log("--- index.md ---");
    console.log(emitted.indexMd);
    console.log("--- config.json ---");
    console.log(emitted.configJson);
    if (useMappedMode) {
      console.log("--- workspace.json ---");
      console.log(`${JSON.stringify(workspace, null, 2)}\n`);
    }

    if (mapperWarnings.length > 0) {
      console.log("--- mapper diagnostics ---");
      for (const line of mapperWarnings) {
        console.log(line);
      }
    }
    if (emitted.diagnostics.length > 0) {
      console.log("--- diagnostics ---");
      for (const diagnostic of emitted.diagnostics) {
        const path = diagnostic.path ? ` (${diagnostic.path})` : "";
        console.log(
          `[${diagnostic.level}] ${diagnostic.code}: ${diagnostic.message}${path}`,
        );
      }
    }
    return;
  }

  let workspaceOutPath: string | undefined;
  if (useMappedMode) {
    workspaceOutPath = resolve(
      args.workspaceOutPath ?? join(outDir, "workspace.json"),
    );
    await mkdir(resolve(outDir), { recursive: true });
    await writeFile(
      workspaceOutPath,
      `${JSON.stringify(workspace, null, 2)}\n`,
      "utf-8",
    );
  }

  const result = await writeSpecPackage({
    workspace,
    config,
    documentId: args.documentId,
    outDir,
  });

  console.log(`Wrote ${result.indexMdPath}`);
  console.log(`Wrote ${result.configPath}`);
  if (workspaceOutPath) {
    console.log(`Wrote ${workspaceOutPath}`);
  }

  if (mapperWarnings.length > 0) {
    console.warn("Mapper diagnostics:");
    for (const line of mapperWarnings) {
      console.warn(`  ${line}`);
    }
  }

  if (result.diagnostics.length > 0) {
    console.warn("Diagnostics:");
    for (const diagnostic of result.diagnostics) {
      const path = diagnostic.path ? ` (${diagnostic.path})` : "";
      console.warn(
        `  [${diagnostic.level}] ${diagnostic.code}: ${diagnostic.message}${path}`,
      );
    }
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
