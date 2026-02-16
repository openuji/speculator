import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  NodeFileProvider,
  SpeculatorPipeline,
  buildWorkspaces,
  corePlugins,
} from "@openuji/speculator";
import { buildVocab } from "@openuji/vocab-build";
import { loadSpecEnv } from "./lib/spec-env.mjs";

const SUPPORTED_MODULES = new Set(["core", "ui"]);
const XSD_NAMESPACE = "http://www.w3.org/2001/XMLSchema#";

const CLASS_DFN_TYPES = new Set([
  "dfn",
  "interface",
  "namespace",
  "dictionary",
  "callback",
  "enum",
  "typedef",
]);

const PROPERTY_DFN_TYPES = new Set([
  "attribute",
  "method",
  "field",
  "dict-member",
  "const",
  "operation",
]);

const parseModulesFromArgs = () => {
  const modules = new Set();
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--module") {
      const value = args[index + 1];
      if (!value) {
        throw new Error('Missing value for "--module".');
      }
      modules.add(value.trim().toLowerCase());
      index += 1;
      continue;
    }

    if (arg.startsWith("--module=")) {
      modules.add(arg.slice("--module=".length).trim().toLowerCase());
      continue;
    }
  }

  return modules;
};

const interpolateSpecEnv = (content, env) =>
  content.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, p1, p2) => {
    const varName = p1 || p2;
    if (!varName.startsWith("SPEC_")) {
      return "";
    }
    return env[varName] || "";
  });

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

const groupBuildErrors = (errors) => {
  const grouped = new Map();

  for (const error of errors) {
    const match = String(error).match(/^\[([^\]]+)\]\s*(.*)$/);
    const workspaceKey = match?.[1] || "_global";
    const message = match?.[2] || String(error);
    const list = grouped.get(workspaceKey) || [];
    list.push(message);
    grouped.set(workspaceKey, list);
  }

  return grouped;
};

const extractVocabModules = (document) => {
  const metadata = document.metadata && typeof document.metadata === "object" ? document.metadata : {};
  const custom = metadata.custom && typeof metadata.custom === "object" ? metadata.custom : {};
  const rawModules = Array.isArray(custom.vocabModules) ? custom.vocabModules : [];

  const normalized = rawModules
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const unique = Array.from(new Set(normalized));
  if (!unique.includes("core")) {
    unique.unshift("core");
  }

  return unique;
};

const documentUsesModule = (document, moduleName) =>
  extractVocabModules(document).includes(moduleName);

const collectWorkspaceContext = async (appRoot, env) => {
  const workspaceConfigPath = path.join(appRoot, "speculator.workspace.json");
  const workspaceConfig = JSON.parse(await fs.readFile(workspaceConfigPath, "utf-8"));
  const entryMap = resolveEntryMapPaths(workspaceConfig, appRoot);

  const { workspaces, errors } = await buildWorkspaces({
    entryMap,
    fileProvider: new NodeFileProvider(),
    pipeline: new SpeculatorPipeline(corePlugins),
    env,
  });

  if (errors.length > 0) {
    console.warn("[vocab:build] Workspace build reported issues:");
    for (const error of errors) {
      console.warn(`  - ${error}`);
    }
  }

  const modules = new Set();

  for (const workspace of Object.values(workspaces)) {
    for (const document of workspace.documents) {
      for (const moduleName of extractVocabModules(document)) {
        modules.add(moduleName);
      }
    }
  }

  if (modules.size === 0) {
    modules.add("core");
  }

  if (!modules.has("core")) {
    modules.add("core");
  }

  return {
    modules,
    workspaces,
    buildErrorsByWorkspace: groupBuildErrors(errors),
  };
};

const splitWords = (value) =>
  String(value || "")
    .replace(/\//g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-zA-Z0-9 ]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const toTitleLabel = (value) => {
  const words = splitWords(value);
  if (words.length === 0) {
    return String(value || "");
  }
  return words.map((word) => capitalize(word.toLowerCase())).join(" ");
};

const sanitizeIdentifier = (value, fallbackPrefix) => {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!cleaned) {
    return `${fallbackPrefix}Term`;
  }

  if (!/^[a-zA-Z]/.test(cleaned)) {
    return `${fallbackPrefix}${cleaned}`;
  }

  return cleaned;
};

const toClassId = (term) => {
  const original = String(term || "").trim();

  if (/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(original) && /[A-Z]/.test(original)) {
    return original;
  }

  const words = splitWords(original);
  const joined = words.map((word) => capitalize(word.toLowerCase())).join("");
  return sanitizeIdentifier(joined, "Term");
};

const toLowerCamel = (value) => {
  const words = splitWords(value);
  if (words.length === 0) {
    return "term";
  }

  const [first, ...rest] = words;
  const normalized = [first.toLowerCase(), ...rest.map((word) => capitalize(word.toLowerCase()))].join("");
  return sanitizeIdentifier(normalized, "p");
};

const toScopedPropertyId = (ownerClassId, memberTerm) => {
  const ownerCamel = ownerClassId.charAt(0).toLowerCase() + ownerClassId.slice(1);
  const memberCamel = toLowerCamel(memberTerm);
  const propertyId = `${ownerCamel}${capitalize(memberCamel)}`;
  return sanitizeIdentifier(propertyId, "p");
};

const inferDefinitionKind = (definition) => {
  const dfnType = String(definition.dfnType || "dfn").toLowerCase();

  if (PROPERTY_DFN_TYPES.has(dfnType)) {
    return "Property";
  }

  if (CLASS_DFN_TYPES.has(dfnType)) {
    return "Class";
  }

  if (String(definition.term || "").includes("/")) {
    return "Property";
  }

  return "Class";
};

const getClassSortWeight = (definition) => {
  const dfnType = String(definition.dfnType || "dfn").toLowerCase();
  if (dfnType === "interface") return 0;
  if (dfnType === "dictionary") return 1;
  if (dfnType === "namespace") return 2;
  return 3;
};

const parseIdlTypeHintsFromText = (idlText, hints) => {
  let owner = "";

  for (const rawLine of String(idlText || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("//")) {
      continue;
    }

    const ownerMatch = line.match(/^(?:partial\s+)?(?:interface|dictionary)\s+([A-Za-z_][A-Za-z0-9_]*)\b/);
    if (ownerMatch) {
      owner = ownerMatch[1];
      continue;
    }

    if (line.startsWith("};") || line === "}" || line === "};") {
      owner = "";
      continue;
    }

    if (!owner) {
      continue;
    }

    const attributeMatch = line.match(/^(?:readonly\s+)?attribute\s+(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/);
    if (attributeMatch) {
      hints.set(`${owner}/${attributeMatch[2]}`, attributeMatch[1].trim());
      continue;
    }

    const methodMatch = line.match(/^(.+?)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\([^;]*\)\s*;/);
    if (methodMatch) {
      hints.set(`${owner}/${methodMatch[2]}`, methodMatch[1].trim());
    }
  }
};

const collectIdlTypeHints = (document) => {
  const hints = new Map();

  const visitBlocks = (nodes) => {
    for (const node of nodes || []) {
      if (!node || typeof node !== "object") {
        continue;
      }

      if (node.type === "idl" && typeof node.value === "string") {
        parseIdlTypeHintsFromText(node.value, hints);
      }

      if (Array.isArray(node.children)) {
        visitBlocks(node.children);
      }
    }
  };

  visitBlocks(document.children);
  return hints;
};

const numericIdlTypes = new Set([
  "byte",
  "octet",
  "short",
  "unsigned short",
  "long",
  "unsigned long",
  "long long",
  "unsigned long long",
]);

const decimalIdlTypes = new Set([
  "float",
  "double",
  "unrestricted float",
  "unrestricted double",
]);

const stringIdlTypes = new Set([
  "domstring",
  "usvstring",
  "bytestring",
  "string",
]);

const mapIdlTypeToRange = (idlType, namespace, knownClassIds) => {
  let normalized = String(idlType || "").trim().replace(/\s+/g, " ");
  if (!normalized) {
    return undefined;
  }

  if (normalized.endsWith("?")) {
    normalized = normalized.slice(0, -1).trim();
  }

  const collectionMatch = normalized.match(/^(?:FrozenArray|sequence)\s*<\s*(.+?)\s*>$/i);
  if (collectionMatch) {
    return mapIdlTypeToRange(collectionMatch[1], namespace, knownClassIds);
  }

  const lower = normalized.toLowerCase();

  if (lower === "boolean") {
    return `${XSD_NAMESPACE}boolean`;
  }

  if (numericIdlTypes.has(lower)) {
    return `${XSD_NAMESPACE}integer`;
  }

  if (decimalIdlTypes.has(lower)) {
    return `${XSD_NAMESPACE}decimal`;
  }

  if (stringIdlTypes.has(lower)) {
    return `${XSD_NAMESPACE}string`;
  }

  if (lower === "void" || lower === "any" || lower === "object") {
    return undefined;
  }

  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    const classId = toClassId(normalized);
    if (knownClassIds.has(classId)) {
      return `${namespace}${classId}`;
    }
  }

  return undefined;
};

const buildCoreSourceFromSpecs = (workspaceContext, baseUrl) => {
  const namespace = `${baseUrl}/vocab/ns#`;
  const docBase = `${baseUrl}/vocab/ns`;

  const classTerms = new Map();
  const propertyTerms = new Map();
  const classIdByTerm = new Map();
  const skippedWorkspaces = [];

  for (const [workspaceKey, workspace] of Object.entries(workspaceContext.workspaces)) {
    const buildErrors = workspaceContext.buildErrorsByWorkspace.get(workspaceKey) || [];
    if (buildErrors.length > 0) {
      skippedWorkspaces.push(workspaceKey);
      continue;
    }

    for (const document of workspace.documents) {
      if (!documentUsesModule(document, "core")) {
        continue;
      }

      const definitions = Array.isArray(document.indexes?.definitions)
        ? document.indexes.definitions
        : [];

      if (definitions.length === 0) {
        continue;
      }

      const documentTitle = String(document.metadata?.title || document.id || "Untitled document");
      const idlHints = collectIdlTypeHints(document);

      const classDefinitions = definitions
        .filter((definition) => inferDefinitionKind(definition) === "Class")
        .sort((left, right) => {
          const weight = getClassSortWeight(left) - getClassSortWeight(right);
          if (weight !== 0) {
            return weight;
          }
          return String(left.term || "").localeCompare(String(right.term || ""));
        });

      for (const definition of classDefinitions) {
        const rawTerm = String(definition.term || "").trim();
        if (!rawTerm) {
          continue;
        }

        const classTerm = rawTerm.includes("/") ? rawTerm.split("/")[0] : rawTerm;
        const classId = toClassId(classTerm);
        classIdByTerm.set(classTerm.toLowerCase(), classId);

        if (!classTerms.has(classId)) {
          classTerms.set(classId, {
            id: classId,
            kind: "Class",
            label: toTitleLabel(classTerm),
            comment: `Defined in ${documentTitle} as "${rawTerm}".`,
          });
        }
      }

      const knownClassIds = new Set(classTerms.keys());

      const propertyDefinitions = definitions.filter(
        (definition) => inferDefinitionKind(definition) === "Property"
      );

      for (const definition of propertyDefinitions) {
        const rawTerm = String(definition.term || "").trim();
        if (!rawTerm || !rawTerm.includes("/")) {
          continue;
        }

        const [ownerTermRaw, memberTermRaw] = rawTerm.split("/", 2);
        const ownerTerm = ownerTermRaw.trim();
        const memberTerm = memberTermRaw.trim();

        if (!ownerTerm || !memberTerm) {
          continue;
        }

        const ownerClassId = classIdByTerm.get(ownerTerm.toLowerCase()) || toClassId(ownerTerm);
        classIdByTerm.set(ownerTerm.toLowerCase(), ownerClassId);

        if (!classTerms.has(ownerClassId)) {
          classTerms.set(ownerClassId, {
            id: ownerClassId,
            kind: "Class",
            label: toTitleLabel(ownerTerm),
            comment: `Inferred from property definition "${rawTerm}" in ${documentTitle}.`,
          });
          knownClassIds.add(ownerClassId);
        }

        const propertyId = toScopedPropertyId(ownerClassId, memberTerm);
        if (propertyTerms.has(propertyId)) {
          continue;
        }

        const rangeHint = idlHints.get(`${ownerTerm}/${memberTerm}`) || idlHints.get(`${ownerClassId}/${memberTerm}`);
        const range = mapIdlTypeToRange(rangeHint, namespace, knownClassIds);

        const term = {
          id: propertyId,
          kind: "Property",
          label: toTitleLabel(memberTerm),
          comment: `Defined on ${ownerClassId} in ${documentTitle}.`,
          domain: `${namespace}${ownerClassId}`,
          ...(range ? { range } : {}),
        };

        propertyTerms.set(propertyId, term);
      }
    }
  }

  if (skippedWorkspaces.length > 0) {
    console.warn(
      `[vocab:build] Skipping core term derivation for workspaces with build errors: ${skippedWorkspaces.join(", ")}`
    );
  }

  const terms = [...classTerms.values(), ...propertyTerms.values()].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "Class" ? -1 : 1;
    }
    return left.id.localeCompare(right.id);
  });

  if (terms.length === 0) {
    throw new Error("[vocab:build] No core terms could be derived from workspace definitions.");
  }

  return {
    module: "core",
    namespace,
    docBase,
    title: "Speculator Demo Core Vocabulary",
    description: "Core terms derived from workspace specification definitions.",
    status: "ED",
    updated: new Date().toISOString().slice(0, 10),
    terms,
  };
};

const loadModuleSourceFromFile = async (appRoot, moduleName, env) => {
  const sourcePath = path.join(appRoot, "vocab", `ed-${moduleName}.jsonld`);
  const rawSource = await fs.readFile(sourcePath, "utf-8");
  const interpolated = interpolateSpecEnv(rawSource, env);
  return JSON.parse(interpolated);
};

const validateResolvedSource = (moduleName, source, baseUrl) => {
  const pathPrefix = moduleName === "core" ? "ns" : "ui";
  const expectedDocBase = `${baseUrl}/vocab/${pathPrefix}`;
  const expectedNamespace = `${expectedDocBase}#`;

  if (source.docBase !== expectedDocBase) {
    throw new Error(
      `[vocab:build] ${moduleName} docBase must be "${expectedDocBase}" (received "${source.docBase}")`
    );
  }

  if (source.namespace !== expectedNamespace) {
    throw new Error(
      `[vocab:build] ${moduleName} namespace must be "${expectedNamespace}" (received "${source.namespace}")`
    );
  }

  const isXsdIri = (value) => value.startsWith(XSD_NAMESPACE);

  for (const term of source.terms || []) {
    if (term.domain && term.domain.startsWith(baseUrl) && !term.domain.startsWith(expectedNamespace)) {
      throw new Error(
        `[vocab:build] ${moduleName} term "${term.id}" has domain outside its namespace: "${term.domain}"`
      );
    }

    if (
      term.range &&
      term.range.startsWith(baseUrl) &&
      !term.range.startsWith(expectedNamespace) &&
      !isXsdIri(term.range)
    ) {
      throw new Error(
        `[vocab:build] ${moduleName} term "${term.id}" has range outside its namespace: "${term.range}"`
      );
    }
  }
};

const buildModuleFromSource = async (appRoot, moduleName, source, baseUrl) => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `astro-demo-vocab-${moduleName}-`));
  const tempSourcePath = path.join(tempDir, `ed-${moduleName}.jsonld`);

  try {
    await fs.writeFile(tempSourcePath, `${JSON.stringify(source, null, 2)}\n`, "utf-8");
    const result = await buildVocab({
      input: tempSourcePath,
      output: path.join(appRoot, "public/vocab"),
      module: moduleName,
      mode: "ED",
      redirects: "netlify",
      baseUrl,
    });

    if (!result.success) {
      throw new Error(result.errors?.join("\n") || `Unable to build ${moduleName} vocabulary`);
    }

    return result.files;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const main = async () => {
  const appRoot = process.cwd();
  const { env, baseUrl } = await loadSpecEnv(appRoot);
  const workspaceContext = await collectWorkspaceContext(appRoot, env);

  const requestedModules = parseModulesFromArgs();
  const modules = requestedModules.size > 0 ? requestedModules : workspaceContext.modules;

  for (const moduleName of modules) {
    if (!SUPPORTED_MODULES.has(moduleName)) {
      throw new Error(
        `[vocab:build] Unsupported module "${moduleName}". Supported: ${Array.from(SUPPORTED_MODULES).join(", ")}`
      );
    }
  }

  const moduleList = Array.from(modules).sort();
  console.log(`[vocab:build] Building modules: ${moduleList.join(", ")} (SPEC_BASE_URL=${baseUrl})`);

  const generated = [];
  for (const moduleName of moduleList) {
    const source =
      moduleName === "core"
        ? buildCoreSourceFromSpecs(workspaceContext, baseUrl)
        : await loadModuleSourceFromFile(appRoot, moduleName, env);

    validateResolvedSource(moduleName, source, baseUrl);
    const files = await buildModuleFromSource(appRoot, moduleName, source, baseUrl);
    generated.push(...files);
  }

  console.log(`[vocab:build] Generated ${generated.length} file(s).`);
};

main().catch((error) => {
  console.error("[vocab:build] failed:", error);
  process.exit(1);
});
