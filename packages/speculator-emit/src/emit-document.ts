import type { Document } from '@openuji/speculator';
import type { EmitContext } from './diagnostics.js';
import { emitNodes } from './emit-block.js';

export function emitDocument(document: Document, ctx: EmitContext): string {
    const body = emitNodes(document.children, ctx, 'document.children');
    return body.trim();
}
