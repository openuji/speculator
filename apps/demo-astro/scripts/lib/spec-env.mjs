import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SPEC_BASE_URL = "http://localhost:4321";

const ENV_ASSIGNMENT_PATTERN = /^\s*(?:export\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.*)\s*$/;

const unquote = (value) => {
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

const parseEnvFile = (content) => {
  const parsed = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = rawLine.match(ENV_ASSIGNMENT_PATTERN);
    if (!match) {
      continue;
    }

    const key = match[1];
    const value = unquote(match[2] || "");
    parsed[key] = value;
  }

  return parsed;
};

const readEnvFile = async (filePath) => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return parseEnvFile(content);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
};

export const normalizeSpecBaseUrl = (value) => {
  const normalized = value?.trim() || DEFAULT_SPEC_BASE_URL;
  try {
    return new URL(normalized).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid SPEC_BASE_URL: "${normalized}"`);
  }
};

export const loadSpecEnv = async (appRoot) => {
  const envFromDotFile = {
    ...(await readEnvFile(path.join(appRoot, ".env"))),
    ...(await readEnvFile(path.join(appRoot, ".env.local"))),
  };

  const merged = { ...envFromDotFile, ...process.env };
  const baseUrl = normalizeSpecBaseUrl(merged.SPEC_BASE_URL);

  return {
    env: { ...merged, SPEC_BASE_URL: baseUrl },
    baseUrl,
  };
};
