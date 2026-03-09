#!/usr/bin/env node
/**
 * CLI for @openuji/bikeshed-migrate
 *
 * Usage:
 *   bikeshed-migrate <input.bs> [--out <dir>] [--dry-run]
 *   bikeshed-migrate <input.bs> --semantic-ir [--out <dir>] [--docker-image <image>]
 */

import { readFile, writeFile, copyFile, mkdir, access } from "node:fs/promises";
import { resolve, dirname, basename, join } from "node:path";
import { migrate } from "./migrate.js";
import { importBikeshedSpec } from "./import-bikeshed-spec.js";
import { DockerBikeshedRenderer } from "./renderer/docker.js";
import {
  fetchBoilerplate,
  renderBoilerplateFile,
  parseLogoSlot,
  SLOT_HEADINGS,
} from "./boilerplate.js";

interface MmdResolution {
  content: string;
  /** .mmd files to copy: { src: absolute source path, dest: absolute dest path } */
  filesToCopy: Array<{ src: string; dest: string }>;
}

/**
 * Replace <img src="*.mmd.*"> with :::include ./file.mmd::: when the .mmd source
 * exists next to the input file. Returns the modified content and the list of .mmd
 * files that must be copied into outputDir so the includes resolve correctly.
 */
async function resolveMmdImages(
  content: string,
  inputDir: string,
  outputDir: string,
): Promise<MmdResolution> {
  const IMG_RE = /<img\b([^>]*)>/gi;
  const replacements: Array<[start: number, end: number, text: string]> = [];
  const filesToCopy: MmdResolution["filesToCopy"] = [];

  let m: RegExpExecArray | null;
  while ((m = IMG_RE.exec(content)) !== null) {
    const srcMatch = m[1].match(/\bsrc="([^"]*\.mmd[^"]*)"/);
    if (!srcMatch) continue;

    const mmdFile = srcMatch[1].replace(/\.mmd.*$/, "") + ".mmd";
    const srcPath = join(inputDir, mmdFile);
    try {
      await access(srcPath);
      replacements.push([
        m.index,
        m.index + m[0].length,
        `:::include ./${mmdFile}:::`,
      ]);
      if (resolve(inputDir) !== resolve(outputDir)) {
        filesToCopy.push({ src: srcPath, dest: join(outputDir, mmdFile) });
      }
    } catch {
      /* .mmd file not found — leave img as-is */
    }
  }

  // Apply from end to start to preserve indices
  let result = content;
  for (const [start, end, text] of replacements.reverse()) {
    result = result.slice(0, start) + text + result.slice(end);
  }
  return { content: result, filesToCopy };
}

interface SemanticImportRunOptions {
  inputPath: string;
  outputDir: string;
  content: string;
  dryRun: boolean;
  dockerImage?: string;
  dockerCommand?: string;
}

async function runSemanticImport(
  options: SemanticImportRunOptions,
): Promise<void> {
  const renderer = new DockerBikeshedRenderer({
    image: options.dockerImage,
    command: options.dockerCommand,
  });

  const result = await importBikeshedSpec(options.content, {
    renderer,
    sourcePath: options.inputPath,
  });

  const semanticIrJson = JSON.stringify(result.document, null, 2);
  const renderedHtml = result.renderedHtml;

  const semanticIrPath = join(options.outputDir, "semantic-ir.json");
  const renderedHtmlPath = join(options.outputDir, "index.html");
  const configPath = join(options.outputDir, "config.json");
  const configJson = JSON.stringify(result.config, null, 2);

  if (options.dryRun) {
    console.log("\n--- semantic-ir.json ---");
    console.log(semanticIrJson);
    console.log("\n--- index.html ---");
    console.log(renderedHtml);
    console.log("\n--- config.json ---");
    console.log(configJson);
    if (result.rendererLogs.length > 0) {
      console.log("\n--- renderer logs ---");
      console.log(result.rendererLogs.join("\n"));
    }
    if (
      result.rendererDiagnostics.length > 0 ||
      result.diagnostics.length > 0
    ) {
      console.log("\n--- diagnostics ---");
      for (const diagnostic of result.rendererDiagnostics) {
        console.log(`[renderer:${diagnostic.level}] ${diagnostic.message}`);
      }
      for (const diagnostic of result.diagnostics) {
        console.log(
          `[${diagnostic.stage}:${diagnostic.level}] ${diagnostic.message}`,
        );
      }
    }
    return;
  }

  await mkdir(options.outputDir, { recursive: true });
  await writeFile(semanticIrPath, semanticIrJson + "\n", "utf-8");
  await writeFile(renderedHtmlPath, renderedHtml.trimEnd() + "\n", "utf-8");
  await writeFile(configPath, configJson + "\n", "utf-8");

  console.log(`✓ Wrote ${semanticIrPath}`);
  console.log(`✓ Wrote ${renderedHtmlPath}`);
  console.log(`✓ Wrote ${configPath}`);

  if (result.rendererDiagnostics.length > 0 || result.diagnostics.length > 0) {
    console.warn("⚠ Import diagnostics were reported:");
    for (const diagnostic of result.rendererDiagnostics) {
      console.warn(`  [renderer:${diagnostic.level}] ${diagnostic.message}`);
    }
    for (const diagnostic of result.diagnostics) {
      console.warn(
        `  [${diagnostic.stage}:${diagnostic.level}] ${diagnostic.message}`,
      );
    }
  }
}

function printUsage() {
  console.log(
    `
Usage: bikeshed-migrate <input.bs> [options]

Options:
  --out <dir>         Output directory (default: same directory as input file)
  --semantic-ir       Use Bikeshed HTML importer (outputs semantic-ir.json + index.html + config.json)
  --html-import       Alias for --semantic-ir
  --docker-image <i>  Docker image for Bikeshed renderer (default: openuji/bikeshed-renderer:latest)
  --docker-command <c> Docker binary/command (default: docker)
  --no-boilerplate    Skip fetching boilerplate overrides (includes/*.md)
  --init              Scaffold a solospec app (vite.config.ts, package.json, index.html)
  --dry-run           Print outputs to stdout without writing files
  --help              Show this help message
`.trim(),
  );
}

async function scaffoldSolospecApp(
  outputDir: string,
  id: string,
): Promise<void> {
  const viteConfig = `import { defineConfig } from 'vite';
import { solospecPlugin } from '@openuji/solospec/vite';

export default defineConfig({
  plugins: [
    solospecPlugin({
      entry: './index.md',
      configPath: './config.json',
      theme: {
        name: 'bikeshed'
      },
    })
  ],
});
`;

  const packageJson = JSON.stringify(
    {
      name: id,
      private: true,
      type: "module",
      scripts: {
        build: "vite build",
        dev: "vite",
        lint: "speculator-lint",
      },
      dependencies: {
        "@openuji/solospec": "latest",
      },
      devDependencies: {
        vite: "^6.1.1",
      },
    },
    null,
    2,
  );

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${id}</title>
</head>
<body>
  <!-- @openuji/solospec -->
</body>
</html>
`;

  await writeFile(join(outputDir, "vite.config.ts"), viteConfig, "utf-8");
  console.log(`✓ Wrote ${join(outputDir, "vite.config.ts")}`);
  await writeFile(join(outputDir, "package.json"), packageJson + "\n", "utf-8");
  console.log(`✓ Wrote ${join(outputDir, "package.json")}`);
  await writeFile(join(outputDir, "index.html"), indexHtml, "utf-8");
  console.log(`✓ Wrote ${join(outputDir, "index.html")}`);
}

async function run() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  // Parse arguments
  let inputFile: string | undefined;
  let outDir: string | undefined;
  let dryRun = false;
  let skipBoilerplate = false;
  let init = false;
  let semanticIrMode = false;
  let dockerImage: string | undefined;
  let dockerCommand: string | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--out" || arg === "-o") {
      outDir = args[++i];
    } else if (arg === "--semantic-ir" || arg === "--html-import") {
      semanticIrMode = true;
    } else if (arg === "--docker-image") {
      dockerImage = args[++i];
    } else if (arg === "--docker-command") {
      dockerCommand = args[++i];
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--no-boilerplate") {
      skipBoilerplate = true;
    } else if (arg === "--init") {
      init = true;
    } else if (!arg.startsWith("-")) {
      if (!inputFile) {
        inputFile = arg;
      } else if (!outDir) {
        outDir = arg;
      } else {
        console.error(`Unexpected argument: ${arg}`);
        printUsage();
        process.exit(1);
      }
    } else {
      console.error(`Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!inputFile) {
    console.error("Error: No input file specified.");
    printUsage();
    process.exit(1);
  }

  const inputPath = resolve(inputFile);
  const outputDir = outDir ? resolve(outDir) : dirname(inputPath);
  const inputName = basename(inputFile, ".bs");

  // Read input
  let content: string;
  try {
    content = await readFile(inputPath, "utf-8");
  } catch (err) {
    console.error(`Error reading ${inputPath}: ${(err as Error).message}`);
    process.exit(1);
  }

  if (semanticIrMode) {
    try {
      await runSemanticImport({
        inputPath,
        outputDir,
        content,
        dryRun,
        dockerImage,
        dockerCommand,
      });
    } catch (err) {
      console.error(`Semantic import failed: ${(err as Error).message}`);
      process.exit(1);
    }
    return;
  }

  // Replace <img src="*.mmd.*"> with :::include ./*.mmd::: where .mmd file exists
  const { content: resolvedContent, filesToCopy } = await resolveMmdImages(
    content,
    dirname(inputPath),
    outputDir,
  );
  content = resolvedContent;

  // Migrate
  let result;
  try {
    result = await migrate(content);
  } catch (err) {
    console.error(`Migration failed: ${(err as Error).message}`);
    process.exit(1);
  }

  const mdPath = join(outputDir, `${inputName}.md`);
  const configPath = join(outputDir, "config.json");

  const styles = result.resources
    .filter((r) => r.type === "style")
    .map((r) => r.content)
    .join("\n\n");
  const scripts = result.resources
    .filter((r) => r.type === "script")
    .map((r) => r.content)
    .join("\n\n");
  const stylePath = styles ? join(outputDir, "style.css") : null;
  const scriptPath = scripts ? join(outputDir, "script.js") : null;

  // Fetch boilerplate includes by default when Group + Status are present
  const group = result.config.bikeshed?.group as string | undefined;
  const status = result.config.bikeshed?.status as string | undefined;
  let boilerplate: Awaited<ReturnType<typeof fetchBoilerplate>> | null = null;

  if (!skipBoilerplate && group && status) {
    console.log(`Fetching boilerplate for group=${group}, status=${status}…`);
    boilerplate = await fetchBoilerplate(group, status);
  }

  // Inject copyright into config (not an include file)
  if (boilerplate?.copyright) {
    result.config.custom ??= {};
    result.config.custom.copyright = renderBoilerplateFile(
      "copyright",
      boilerplate.copyright,
    ).trim();
  }

  // Inject logo into config.custom.logo (not an include file)
  if (boilerplate?.logo) {
    const logo = parseLogoSlot(boilerplate.logo);
    if (logo) {
      result.config.custom ??= {};
      result.config.custom.logo = logo;
    }
  }

  // Build include injection for index.md
  const headerIncludes: string[] = [];
  if (result.abstract)
    headerIncludes.push(":::include ./includes/abstract.md :::");
  if (boilerplate?.status)
    headerIncludes.push(":::include ./includes/status.md :::");

  const footerIncludes: string[] = [];
  const boilerplateConfig = result.config.bikeshed?.boilerplate;
  const omitConformance =
    typeof boilerplateConfig === "string" &&
    boilerplateConfig.toLowerCase().includes("omit conformance");

  if (boilerplate?.conformance && !omitConformance) {
    footerIncludes.push(":::include ./includes/conformance.md :::");
  }
  footerIncludes.push("<spec-biblio-references />");

  if (headerIncludes.length)
    result.md = headerIncludes.join("\n") + "\n\n" + result.md;
  result.md = result.md + "\n\n" + footerIncludes.join("\n\n");

  const configJson = JSON.stringify(result.config, null, 2);

  if (dryRun) {
    console.log(`\n--- ${inputName}.md ---`);
    console.log(result.md);
    console.log("\n--- config.json ---");
    console.log(configJson);
    if (styles) {
      console.log("\n--- style.css ---");
      console.log(styles);
    }
    if (scripts) {
      console.log("\n--- script.js ---");
      console.log(scripts);
    }
    if (result.abstract) {
      console.log("\n--- includes/abstract.md ---");
      console.log(`${SLOT_HEADINGS["abstract"]}\n\n${result.abstract.trim()}`);
    }
    if (boilerplate) {
      for (const [slot, resolved] of Object.entries(boilerplate)) {
        if (slot === "copyright" || slot === "logo") continue;
        console.log(`\n--- includes/${slot}.md --- (${resolved.source})`);
        console.log(resolved.content);
      }
    }
    return;
  }

  // Write outputs
  await mkdir(outputDir, { recursive: true });

  for (const { src, dest } of filesToCopy) {
    await mkdir(dirname(dest), { recursive: true });
    await copyFile(src, dest);
    console.log(`✓ Copied ${dest}`);
  }

  await writeFile(mdPath, result.md + "\n", "utf-8");
  await writeFile(configPath, configJson + "\n", "utf-8");

  console.log(`✓ Wrote ${mdPath}`);
  console.log(`✓ Wrote ${configPath}`);

  if (stylePath) {
    await writeFile(stylePath, styles + "\n", "utf-8");
    console.log(
      `✓ Wrote ${stylePath}  (${result.resources.filter((r) => r.type === "style").length} style block(s))`,
    );
  }
  if (scriptPath) {
    await writeFile(scriptPath, scripts + "\n", "utf-8");
    console.log(
      `✓ Wrote ${scriptPath}  (${result.resources.filter((r) => r.type === "script").length} script block(s))`,
    );
  }

  // Write includes/abstract.md from metadata Abstract: field (always, not tied to boilerplate)
  if (result.abstract) {
    const abstract = result.abstract;
    const includesDir = join(outputDir, "includes");
    await mkdir(includesDir, { recursive: true });
    const abstractPath = join(includesDir, "abstract.md");
    await writeFile(
      abstractPath,
      `${SLOT_HEADINGS["abstract"]}\n\n${abstract.trim()}\n`,
      "utf-8",
    );
    console.log(`✓ Wrote ${abstractPath}  (from metadata Abstract:)`);
  }

  if (boilerplate) {
    const includesDir = join(outputDir, "includes");
    await mkdir(includesDir, { recursive: true });
    for (const [slot, resolved] of Object.entries(boilerplate)) {
      if (!resolved || slot === "copyright" || slot === "logo") continue; // go into config.json
      const filePath = join(includesDir, `${slot}.md`);
      let content = renderBoilerplateFile(slot, resolved);
      if (slot === "status") {
        content = content
          .replace(/\[STATUSTEXT\]/g, result.statusText?.trim() ?? "")
          .replace(/\n{3,}/g, "\n\n");
      }
      await writeFile(filePath, content, "utf-8");
      console.log(`✓ Wrote ${filePath}  (${resolved.source})`);
    }
    const missing = (["status", "conformance"] as const).filter(
      (s) => !(s in boilerplate!),
    );
    if (missing.length > 0) {
      console.warn(`⚠ No boilerplate found for: ${missing.join(", ")}`);
    }
  }

  if (init) {
    await scaffoldSolospecApp(
      outputDir,
      result.config.bikeshed?.shortname ?? inputName,
    );
  }
}

run().catch((err: unknown) => {
  console.error((err as Error).message);
  process.exit(1);
});
