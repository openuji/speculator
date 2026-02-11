#!/usr/bin/env npx ts-node
/**
 * TypeScript Type Generation Script
 * 
 * Generates TypeScript types from spec-ast.schema.json using json-schema-to-typescript.
 * 
 * Usage:
 *   npx ts-node scripts/generate-types.ts
 * 
 * Output:
 *   src/types/ast.generated.ts
 */

import { compile } from 'json-schema-to-typescript';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.resolve(__dirname, '../schema/spec-ast.schema.json');
const OUTPUT_PATH = path.resolve(__dirname, '../src/types/ast.generated.ts');

async function generateTypes(): Promise<void> {
  console.log('Reading schema from:', SCHEMA_PATH);

  const schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(schemaContent);

  console.log('Generating TypeScript types...');

  const tsTypes = await compile(schema, 'SpeculatorAST', {
    bannerComment: `/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 * 
 * Generated from: schema/spec-ast.schema.json
 * Generated at: ${new Date().toISOString()}
 * 
 * Regenerate with: npx ts-node scripts/generate-types.ts
 */`,
    style: {
      singleQuote: true,
      semi: true,
      tabWidth: 2,
    },
    additionalProperties: false,
    enableConstEnums: true,
    strictIndexSignatures: true,
  });

  // Post-process to add utility types
  const utilityTypes = `

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Alias for the root workspace type
 */
export type Workspace = SpeculatorASTSchema;

/**
 * Extracts semantic-only fields from AST (excludes x-computed fields).
 * Use this type when working with indexers or when computed fields are disabled.
 */
export type SemanticWorkspace = Omit<SpeculatorASTSchema, 'globalIndex'>;

/**
 * Type guard for Workspace nodes
 */
export function isWorkspace(node: unknown): node is SpeculatorASTSchema {
  return typeof node === 'object' && node !== null && (node as any).type === 'workspace';
}

/**
 * Type guard for Document nodes
 */
export function isDocument(node: unknown): node is Document {
  return typeof node === 'object' && node !== null && (node as any).type === 'document';
}

/**
 * Type guard for Section nodes
 */
export function isSection(node: unknown): node is Section {
  return typeof node === 'object' && node !== null && (node as any).type === 'section';
}

/**
 * Type guard for Block nodes
 */
export function isBlock(node: unknown): node is Block {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as any).type;
  return [
    'paragraph', 'heading', 'codeBlock', 'example',
    'blockquote', 'list', 'table', 'thematicBreak', 'html', 'likeC4View',
    'note', 'specStatement'
  ].includes(type);
}

/**
 * Type guard for Inline nodes
 */
export function isInline(node: unknown): node is Inline {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as any).type;
  return [
    'text', 'emphasis', 'strong', 'inlineCode', 'link',
    'image', 'definition', 'requirement', 'issue', 'cite', 'variable',
    'workspaceDfnReference', 'workspaceIdlReference', 'workspaceElementReference',
    'externalDfnReference', 'externalIdlReference', 'externalElementReference',
    'sectionReference'
  ].includes(type);
}

/**
 * Type guard for indexable inline nodes (definitions, references, requirements, issues)
 */
export function isIndexableInline(node: unknown): node is InlineDefinition | InlineWorkspaceDfnReference | InlineWorkspaceIdlReference | InlineWorkspaceElementReference | InlineExternalDfnReference | InlineExternalIdlReference | InlineExternalElementReference | InlineRequirement | InlineIssue | InlineSectionReference {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as any).type;
  return [
    'definition', 'requirement', 'issue',
    'workspaceDfnReference', 'workspaceIdlReference', 'workspaceElementReference',
    'externalDfnReference', 'externalIdlReference', 'externalElementReference',
    'sectionReference'
  ].includes(type);
}

/**
 * Type guard for BlockExample (indexable block)
 */
export function isBlockExample(node: unknown): node is BlockExample {
  return typeof node === 'object' && node !== null && (node as any).type === 'example';
}

/**
 * Node visitor type for AST traversal
 */
export type NodeVisitor<T = void> = {
  workspace?: (node: SpeculatorASTSchema) => T;
  document?: (node: Document) => T;
  section?: (node: Section) => T;
  block?: (node: Block) => T;
  inline?: (node: Inline) => T;
};
`;

  const finalOutput = tsTypes + utilityTypes;

  // Ensure output directory exists
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, finalOutput, 'utf-8');

  console.log('Types generated successfully:', OUTPUT_PATH);
}

generateTypes().catch((error) => {
  console.error('Error generating types:', error);
  process.exit(1);
});
