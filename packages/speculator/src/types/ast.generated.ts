/**
 * AUTO-GENERATED FILE - DO NOT EDIT DIRECTLY
 *
 * Generated from: schema/spec-ast.schema.json
 * Generated at: 2026-01-27T16:58:52.776Z
 *
 * Regenerate with: npx ts-node scripts/generate-types.ts
 */

export type Section = BaseNode & {
  type: 'section';
  /**
   * Optional explicit section identifier
   */
  id?: string;
  /**
   * Optional section heading
   */
  heading?: BaseNode & {
    type: 'heading';
    depth: number;
    /**
     * Optional explicit heading ID
     */
    id?: string;
    children: Inline[];
    /**
     * If true, the section created from this heading will be unnumbered.
     */
    unnumbered?: boolean;
  };
  /**
   * If true, this section and its descendants do not increment the TOC counter at this level.
   */
  unnumbered?: boolean;
  children: (Section | Block)[];
};
export type Inline =
  | InlineText
  | InlineEmphasis
  | InlineStrong
  | InlineCode
  | InlineLink
  | InlineImage
  | InlineDefinition
  | InlineReference
  | InlineRequirement
  | InlineIssue
  | InlineCite
  | InlineVariable;
export type InlineText = BaseNode & {
  type: 'text';
  value: string;
};
export type InlineEmphasis = BaseNode & {
  type: 'emphasis';
  children: Inline[];
};
export type InlineStrong = BaseNode & {
  type: 'strong';
  children: Inline[];
};
export type InlineCode = BaseNode & {
  type: 'inlineCode';
  value: string;
};
export type InlineLink = BaseNode & {
  type: 'link';
  url: string;
  title?: string | null;
  children: Inline[];
};
export type InlineImage = BaseNode & {
  type: 'image';
  url: string;
  alt?: string | null;
  title?: string | null;
};
export type InlineDefinition = BaseNode & {
  type: 'definition';
  /**
   * Author-specified definition identifier, if provided.
   */
  explicitId?: string;
  /**
   * Canonical unique identifier for this definition. May be assigned/refined during resolve.
   */
  id?: string;
  /**
   * The term being defined (normalized)
   */
  term: string;
  /**
   * Alternative link texts from data-lt attribute. Parse fills from data-lt or [term].
   */
  linkTexts?: string[];
  /**
   * For-contexts from data-dfn-for attribute (e.g., owning interface). Parse fills from data-dfn-for or [null].
   */
  forContexts?: (string | null)[];
  /**
   * Definition type from data-dfn-type (e.g., dfn, attribute, method). Defaults to 'dfn'.
   */
  dfnType?: string;
  children: Inline[];
};
/**
 * Union of all inline reference types
 */
export type InlineReference =
  | InlineWorkspaceDfnReference
  | InlineWorkspaceIdlReference
  | InlineWorkspaceElementReference
  | InlineExternalDfnReference
  | InlineExternalIdlReference
  | InlineExternalElementReference;
export type InlineWorkspaceDfnReference = BaseNode &
  WorkspaceReferenceBase & {
    type: 'workspaceDfnReference';
  };
export type InlineWorkspaceIdlReference = BaseNode &
  WorkspaceReferenceBase & {
    type: 'workspaceIdlReference';
  };
export type InlineWorkspaceElementReference = BaseNode &
  WorkspaceReferenceBase & {
    type: 'workspaceElementReference';
  };
export type InlineExternalDfnReference = BaseNode &
  ExternalReferenceBase & {
    type: 'externalDfnReference';
  };
export type InlineExternalIdlReference = BaseNode &
  ExternalReferenceBase & {
    type: 'externalIdlReference';
  };
export type InlineExternalElementReference = BaseNode &
  ExternalReferenceBase & {
    type: 'externalElementReference';
  };
export type InlineRequirement = BaseNode & {
  type: 'requirement';
  keyword:
    | 'MUST'
    | 'MUST NOT'
    | 'REQUIRED'
    | 'SHALL'
    | 'SHALL NOT'
    | 'SHOULD'
    | 'SHOULD NOT'
    | 'RECOMMENDED'
    | 'MAY'
    | 'OPTIONAL';
  /**
   * Optional requirement identifier
   */
  id?: string;
};
export type InlineIssue = BaseNode & {
  type: 'issue';
  id?: string;
  status?: 'open' | 'closed' | 'wontfix';
  children: Inline[];
};
export type InlineCite = BaseNode & {
  type: 'cite';
  /**
   * Citation key (e.g., RFC2119, WHATWG-URL, etc.)
   */
  key: string;
  /**
   * Final citation kind. Determined by forcing or section context.
   */
  kind?: 'normative' | 'informative';
  /**
   * True for [[[FOO]]] form - displays full title.
   */
  expanded?: boolean;
  /**
   * True if [[!FOO]] or data-cite starts with !.
   */
  forcedNormative?: boolean;
  /**
   * True if [[?FOO]] form.
   */
  forcedInformative?: boolean;
  /**
   * Spec shortname from data-cite (e.g., 'html', 'dom').
   */
  specId?: string | null;
  /**
   * Path component from data-cite (e.g., '/section-2').
   */
  path?: string | null;
  /**
   * Fragment identifier from data-cite (e.g., 'the-a-element').
   */
  fragment?: string | null;
  /**
   * Resolved ID of the bibliography entry. Filled during resolve phase.
   */
  targetId?: string;
  /**
   * Resolved URL of the citation. Filled during resolve phase.
   */
  url?: string;
  /**
   * Optional inline content that represents the cite text.
   */
  children?: Inline[];
};
export type InlineVariable = BaseNode & {
  type: 'variable';
  /**
   * The variable name or content.
   */
  value: string;
};
export type Block =
  | BlockParagraph
  | BlockHeading
  | BlockCodeBlock
  | BlockExample
  | BlockQuote
  | BlockList
  | BlockTable
  | BlockThematicBreak
  | BlockHtml
  | BlockNote;
export type BlockParagraph = BaseNode & {
  type: 'paragraph';
  id?: string;
  children: Inline[];
};
export type BlockHeading = BaseNode & {
  type: 'heading';
  depth: number;
  /**
   * Optional explicit heading ID
   */
  id?: string;
  children: Inline[];
  /**
   * If true, the section created from this heading will be unnumbered.
   */
  unnumbered?: boolean;
};
export type BlockCodeBlock = BaseNode & {
  type: 'codeBlock';
  id?: string;
  lang?: string | null;
  meta?: string | null;
  value: string;
};
export type BlockExample = BaseNode & {
  type: 'example';
  id?: string;
  title?: string | null;
  children: Block[];
};
export type BlockQuote = BaseNode & {
  type: 'blockquote';
  id?: string;
  children: Block[];
};
export type BlockList = BaseNode & {
  type: 'list';
  ordered: boolean;
  id?: string;
  /**
   * Starting number for ordered lists
   */
  start?: number | null;
  children: ListItem[];
};
export type ListItem = BaseNode & {
  type: 'listItem';
  /**
   * For task lists: true/false/null
   */
  checked?: boolean | null;
  children: Block[];
};
export type BlockTable = BaseNode & {
  type: 'table';
  children: TableRow[];
  id?: string;
};
export type TableRow = BaseNode & {
  type: 'tableRow';
  children: TableCell[];
};
export type TableCell = BaseNode & {
  type: 'tableCell';
  header?: boolean;
  align?: 'left' | 'center' | 'right' | null;
  children: Inline[];
};
export type BlockThematicBreak = BaseNode & {
  type: 'thematicBreak';
  id?: string;
};
export type BlockHtml = BaseNode & {
  type: 'html';
  id?: string;
  value: string;
};
export type BlockNote = BaseNode & {
  type: 'note';
  id?: string;
  /**
   * Type of note, derived from class or element semantics.
   */
  noteType?: 'note' | 'warning' | 'example' | 'issue';
  /**
   * Always true - marks content scope as informative for citation classification.
   */
  informative: true;
  children: Block[];
};

/**
 * AST-first schema for Speculator workspace. A workspace contains one or more specification documents. Semantic marker nodes are introduced during parse and may be refined during resolve. Global indexing aggregates definitions across documents.
 */
export interface SpeculatorASTSchema {
  /**
   * Schema version for this AST format
   */
  schemaVersion?: '1.1.0';
  type: 'workspace';
  /**
   * Collection of documents in the workspace
   */
  documents: Document[];
  globalIndex?: Indexes1;
}
/**
 * A single specification document
 */
export interface Document {
  type: 'document';
  /**
   * Document identifier, used as slug for internal link resolution. Synced from config.id
   */
  id: string;
  metadata?: DocumentMetadata;
  children: (Section | Block)[];
  indexes?: Indexes;
  computed?: ComputedFields;
  sourcePos?: SourcePos;
}
/**
 * Document-level metadata from frontmatter or config
 */
export interface DocumentMetadata {
  title?: string;
  subtitle?: string;
  shortName?: string;
  status?: string;
  version?: string;
  editors?: {
    name?: string;
    url?: string;
    company?: string;
  }[];
  authors?: {
    name?: string;
    url?: string;
    company?: string;
  }[];
  /**
   * ISO 8601 date format (YYYY-MM-DD)
   */
  publishDate?: string;
  /**
   * Last update date (YYYY-MM-DD)
   */
  lastUpdateDate?: string;
  abstract?: string;
  /**
   * Normalized maturity level
   */
  maturityLevel?: 'incubating' | 'draft' | 'prerelease' | 'stable';
  /**
   * Highest priority user-defined properties
   */
  custom?: {
    [k: string]: unknown | undefined;
  };
}
export interface BaseNode {
  sourcePos?: SourcePos;
}
/**
 * Source position for bidirectional AST-to-source mapping
 */
export interface SourcePos {
  /**
   * Canonical file path (preserves include origins)
   */
  file: string;
  /**
   * 1-indexed line number
   */
  line: number;
  /**
   * 1-indexed column number
   */
  column: number;
  /**
   * 0-indexed byte offset from file start
   */
  offset?: number;
  endLine?: number;
  endColumn?: number;
  endOffset?: number;
}
export interface WorkspaceReferenceBase {
  targetTerm: string;
  candidateTerms?: string[];
  forContexts?: (string | null)[];
  targetId?: string;
  targetDocumentId?: string;
  children: Inline[];
}
export interface ExternalReferenceBase {
  targetTerm: string;
  candidateTerms?: string[];
  forContexts?: (string | null)[];
  xrefSpec: string;
  targetId?: string;
  url?: string;
  children: Inline[];
}
/**
 * Indexes extracted from marker nodes during indexing
 */
export interface Indexes {
  definitions?: IndexDefinitionEntry[];
  references?: IndexReferenceEntry[];
  requirements?: IndexRequirementEntry[];
  issues?: IndexIssueEntry[];
  examples?: IndexExampleEntry[];
  citations?: IndexCiteEntry[];
  bibliography?: IndexBiblioEntry[];
}
/**
 * Entry in the definitions index, extracted from InlineDefinition nodes
 */
export interface IndexDefinitionEntry {
  id: string;
  term: string;
  /**
   * ID of the document containing this definition
   */
  documentId?: string;
  /**
   * Alternative link texts (aliases)
   */
  linkTexts?: string[];
  /**
   * Contexts this definition applies to
   */
  forContexts?: (string | null)[];
  /**
   * Type of definition (e.g. 'interface', 'dfn')
   */
  dfnType?: string;
  sourcePos: SourcePos;
}
/**
 * Entry in the references index, extracted from InlineReference nodes
 */
export interface IndexReferenceEntry {
  /**
   * Concrete reference type (e.g., workspaceDfnReference, externalIdlReference)
   */
  type?: string;
  targetId?: string;
  targetTerm: string;
  targetDocumentId?: string;
  url?: string;
  sourcePos: SourcePos;
}
/**
 * Entry in the requirements index, extracted from InlineRequirement nodes
 */
export interface IndexRequirementEntry {
  id?: string;
  keyword: string;
  sourcePos: SourcePos;
}
/**
 * Entry in the issues index, extracted from InlineIssue nodes
 */
export interface IndexIssueEntry {
  id?: string;
  status?: string;
  sourcePos: SourcePos;
}
/**
 * Entry in the examples index, extracted from BlockExample nodes
 */
export interface IndexExampleEntry {
  id?: string;
  title?: string | null;
  sourcePos: SourcePos;
}
/**
 * Entry in the citations index, extracted from InlineCite nodes
 */
export interface IndexCiteEntry {
  key: string;
  kind?: 'normative' | 'informative';
  sourcePos: SourcePos;
}
/**
 * Entry in the bibliography index, merged from config and/or authored biblio sources during resolve/index phases
 */
export interface IndexBiblioEntry {
  key: string;
  title?: string;
  url?: string;
  /**
   * Optional status or classification for the reference (e.g., 'standard', 'draft')
   */
  status?: string;
  sourcePos?: SourcePos;
}
/**
 * Optional computed fields (x-computed: true)
 */
export interface ComputedFields {
  /**
   * Table of contents derived from headings
   */
  toc?: TocEntry[];
  /**
   * Map of heading ID to hierarchical number string
   */
  headingNumbers?: {
    [k: string]: string | undefined;
  };
  /**
   * Total word count
   */
  wordCount?: number;
  /**
   * Estimated reading time in minutes
   */
  readingTime?: number;
}
/**
 * Table of contents entry
 */
export interface TocEntry {
  id?: string;
  depth: number;
  text: string;
  /**
   * Hierarchical number like '1.2.3'
   */
  number?: string;
  children?: TocEntry[];
}
/**
 * Aggregated global index across all documents
 */
export interface Indexes1 {
  definitions?: IndexDefinitionEntry[];
  references?: IndexReferenceEntry[];
  requirements?: IndexRequirementEntry[];
  issues?: IndexIssueEntry[];
  examples?: IndexExampleEntry[];
  citations?: IndexCiteEntry[];
  bibliography?: IndexBiblioEntry[];
}


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
    'blockquote', 'list', 'table', 'thematicBreak', 'html'
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
    'externalDfnReference', 'externalIdlReference', 'externalElementReference'
  ].includes(type);
}

/**
 * Type guard for indexable inline nodes (definitions, references, requirements, issues)
 */
export function isIndexableInline(node: unknown): node is InlineDefinition | InlineWorkspaceDfnReference | InlineWorkspaceIdlReference | InlineWorkspaceElementReference | InlineExternalDfnReference | InlineExternalIdlReference | InlineExternalElementReference | InlineRequirement | InlineIssue {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as any).type;
  return [
    'definition', 'requirement', 'issue',
    'workspaceDfnReference', 'workspaceIdlReference', 'workspaceElementReference',
    'externalDfnReference', 'externalIdlReference', 'externalElementReference'
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
