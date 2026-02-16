import fs from "node:fs";
import path from "node:path";

export const DEFAULT_SPEC_BASE_URL = "http://localhost:4321";

const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)\s*$/;

const unquote = (value: string): string => {
  if (!value) {
    return "";
  }

  const isDoubleQuoted = value.startsWith('"') && value.endsWith('"');
  const isSingleQuoted = value.startsWith("'") && value.endsWith("'");

  if (isDoubleQuoted || isSingleQuoted) {
    const body = value.slice(1, -1);
    if (!isDoubleQuoted) {
      return body;
    }

    return body
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }

  return value.replace(/\s+#.*$/, "").trim();
};

const parseEnvFile = (content: string): Record<string, string> => {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = rawLine.match(ENV_ASSIGNMENT_PATTERN);
    if (!match) {
      continue;
    }

    parsed[match[1]] = unquote(match[2] || "");
  }

  return parsed;
};

const readEnvFile = (filePath: string): Record<string, string> => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return parseEnvFile(content);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return {};
    }
    throw error;
  }
};

export const normalizeSpecBaseUrl = (value?: string): string => {
  const normalized = value?.trim() || DEFAULT_SPEC_BASE_URL;
  try {
    return new URL(normalized).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid SPEC_BASE_URL: "${normalized}"`);
  }
};

export interface LoadedSpecEnv {
  env: NodeJS.ProcessEnv;
  baseUrl: string;
}

export const loadSpecEnv = (appRoot: string): LoadedSpecEnv => {
  const envFromFiles = {
    ...readEnvFile(path.join(appRoot, ".env")),
    ...readEnvFile(path.join(appRoot, ".env.local")),
  };

  const mergedEnv = { ...envFromFiles, ...process.env };
  const baseUrl = normalizeSpecBaseUrl(mergedEnv.SPEC_BASE_URL);

  return {
    env: { ...mergedEnv, SPEC_BASE_URL: baseUrl },
    baseUrl,
  };
};
