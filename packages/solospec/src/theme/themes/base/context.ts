import { createContext } from 'preact';
import type { AstComponents, BlockRenderContext, InlineRenderContext } from '#src/theme/types';

export const AstComponentsContext = createContext<AstComponents | null>(null);
export const BlockContext = createContext<BlockRenderContext | null>(null);
export const InlineContext = createContext<InlineRenderContext | null>(null);
