import { describe, it, expect } from 'vitest';
import { statementDistributePlugin } from '../statement-distribute';
import type { BlockSpecStatementGroup, Document, BlockList, ListItem } from '#src/types/ast.generated';
import type { TransformContext } from '#src/pipeline/types';

describe('statementDistributePlugin', () => {
    it('distributes dataIdPattern sequentially to list items using {\\d}', async () => {
        const listItems: ListItem[] = [
            { type: 'listItem', children: [], contentText: '', level: 'NONE' },
            { type: 'listItem', children: [], contentText: '', level: 'NONE' }
        ];

        const list: BlockList = {
            type: 'list',
            ordered: false,
            children: listItems
        };

        const group: BlockSpecStatementGroup = {
            type: 'specStatementGroup',
            children: [list],
            dataIdPattern: 'fancy-{\\d}'
        };

        const doc: Document = {
            type: 'document',
            id: 'test',
            children: [group]
        };

        await statementDistributePlugin.transform!({ document: doc } as unknown as TransformContext);

        expect(listItems[0].id).toBe('fancy-1');
        expect(listItems[1].id).toBe('fancy-2');
    });

    it('distributes dataIdPattern lexicographically to list items using {\\a}', async () => {
        const listItems: ListItem[] = [
            { type: 'listItem', children: [], contentText: '', level: 'NONE' },
            { type: 'listItem', children: [], contentText: '', level: 'NONE' },
            { type: 'listItem', children: [], contentText: '', level: 'NONE' }
        ];

        const list: BlockList = {
            type: 'list',
            ordered: false,
            children: listItems
        };

        const group: BlockSpecStatementGroup = {
            type: 'specStatementGroup',
            children: [list],
            dataIdPattern: 'fancy-{\\a}'
        };

        const doc: Document = {
            type: 'document',
            id: 'test',
            children: [group]
        };

        await statementDistributePlugin.transform!({ document: doc } as unknown as TransformContext);

        expect(listItems[0].id).toBe('fancy-a');
        expect(listItems[1].id).toBe('fancy-b');
        expect(listItems[2].id).toBe('fancy-c');
    });
});
