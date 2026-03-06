export type SemanticInlineNode =
    | TextNode
    | LinkRefNode
    | DefinitionNode
    | CodeSpanNode
    | VariableNode
    | ImageInlineNode;

export type SemanticBlockNode =
    | SectionNode
    | ParagraphNode
    | ListNode
    | ListItemNode
    | DefinitionListNode
    | CodeBlockNode
    | IdlBlockNode
    | AlgorithmBlockNode
    | NoteBlockNode
    | DomIntroBlockNode
    | FigureBlockNode
    | ImageAssetNode;

export interface DocumentNode {
    type: 'Document';
    children: Array<SectionNode | SemanticBlockNode>;
}

export interface SectionNode {
    type: 'Section';
    level: number;
    id?: string;
    boilerplate?: 'abstract' | 'sotd' | 'conformance';
    heading: SemanticInlineNode[];
    children: SemanticBlockNode[];
}

export interface ParagraphNode {
    type: 'Paragraph';
    children: SemanticInlineNode[];
}

export interface TextNode {
    type: 'Text';
    value: string;
}

export interface LinkRefNode {
    type: 'LinkRef';
    href?: string;
    dataLinkType?: string;
    dataLinkFor?: string;
    children: SemanticInlineNode[];
}

export interface DefinitionNode {
    type: 'Definition';
    id?: string;
    dfnType?: string;
    dfnFor?: string;
    children: SemanticInlineNode[];
}

export interface CodeSpanNode {
    type: 'CodeSpan';
    value: string;
}

export interface VariableNode {
    type: 'Variable';
    value: string;
}

export interface ImageInlineNode {
    type: 'ImageInline';
    asset: ImageAssetNode;
}

export interface ImageAssetNode {
    type: 'ImageAsset';
    srcOriginal: string;
    srcResolved?: string;
    alt?: string;
    title?: string;
    exists?: boolean;
    generatedFrom?: 'mermaid-mmd';
}

export interface FigureBlockNode {
    type: 'FigureBlock';
    id?: string;
    image?: ImageAssetNode;
    caption: SemanticInlineNode[];
    children: SemanticBlockNode[];
}

export interface CodeBlockNode {
    type: 'CodeBlock';
    language?: string;
    value: string;
}

export interface IdlBlockNode {
    type: 'IdlBlock';
    value: string;
}

export interface AlgorithmBlockNode {
    type: 'AlgorithmBlock';
    name?: string;
    children: SemanticBlockNode[];
}

export interface NoteBlockNode {
    type: 'NoteBlock';
    noteType: 'note' | 'warning' | 'issue' | 'example';
    children: SemanticBlockNode[];
}

export interface DomIntroBlockNode {
    type: 'DomIntroBlock';
    children: SemanticBlockNode[];
}

export interface DefinitionListNode {
    type: 'DefinitionList';
    items: DefinitionListItem[];
}

export interface DefinitionListItem {
    term: SemanticInlineNode[];
    description: SemanticBlockNode[];
}

export interface ListNode {
    type: 'List';
    ordered: boolean;
    start?: number;
    items: ListItemNode[];
}

export interface ListItemNode {
    type: 'ListItem';
    children: SemanticBlockNode[];
}
