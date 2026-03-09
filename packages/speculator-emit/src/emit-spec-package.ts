import type { Document } from "@openuji/speculator";
import { emitCanonicalConfigJson } from "./config-writer.js";
import { createEmitContext } from "./diagnostics.js";
import { emitDocument } from "./emit-document.js";
import type { EmitSpecPackageInput, EmitSpecPackageResult } from "./types.js";

function selectDocument(
  documents: Document[],
  requestedDocumentId: string | undefined,
): Document {
  if (documents.length === 0) {
    throw new Error("Workspace contains no documents to emit.");
  }

  if (!requestedDocumentId) {
    return documents[0];
  }

  const found = documents.find(
    (document) => document.id === requestedDocumentId,
  );
  if (!found) {
    throw new Error(
      `Document "${requestedDocumentId}" was not found in workspace.`,
    );
  }
  return found;
}

export function emitSpecPackage(
  input: EmitSpecPackageInput,
): EmitSpecPackageResult {
  const trailingNewline = input.options?.trailingNewline ?? true;
  const ctx = createEmitContext();

  const document = selectDocument(input.workspace.documents, input.documentId);
  const indexMdBody = emitDocument(document, ctx);
  const indexMd = trailingNewline ? `${indexMdBody}\n` : indexMdBody;
  const configJson = emitCanonicalConfigJson(input.config, trailingNewline);

  return {
    indexMd,
    configJson,
    diagnostics: ctx.diagnostics,
    documentId: document.id,
  };
}
