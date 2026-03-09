import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { emitSpecPackage } from "./emit-spec-package.js";
import type { WriteSpecPackageInput, WriteSpecPackageResult } from "./types.js";

export async function writeSpecPackage(
  input: WriteSpecPackageInput,
): Promise<WriteSpecPackageResult> {
  const emitted = emitSpecPackage(input);
  const outputDir = resolve(input.outDir);
  const indexMdPath = join(outputDir, "index.md");
  const configPath = join(outputDir, "config.json");

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(indexMdPath, emitted.indexMd, "utf-8"),
    writeFile(configPath, emitted.configJson, "utf-8"),
  ]);

  return {
    ...emitted,
    indexMdPath,
    configPath,
  };
}
