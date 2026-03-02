import { describe, expect, it } from 'vitest';
import { SplitNode, deserializeSplitTree, serializeSplitTree, updateSessionIdsInTree } from '../split-pane.js';

describe('split-pane module', () => {
  it('should split leaf node into two children', () => {
    const root = new SplitNode('leaf', 's-1');
    const created = root.split('vertical', 's-2');

    expect(root.type).toBe('vertical');
    expect(root.children).toHaveLength(2);
    expect(root.children[0].sessionId).toBe('s-1');
    expect(created?.sessionId).toBe('s-2');
  });

  it('should serialize and deserialize split tree', () => {
    const root = new SplitNode('leaf', 'a');
    root.split('horizontal', 'b');
    root.ratio = 0.4;

    const serialized = serializeSplitTree(root);
    const restored = deserializeSplitTree(serialized);

    expect(restored?.type).toBe('horizontal');
    expect(restored?.ratio).toBe(0.4);
    expect(restored?.children?.[0]?.sessionId).toBe('a');
    expect(restored?.children?.[1]?.sessionId).toBe('b');
  });

  it('should update session ids in serialized tree', () => {
    const tree = {
      type: 'horizontal',
      ratio: 0.5,
      children: [
        { type: 'leaf', sessionId: 'old-1' },
        { type: 'leaf', sessionId: 'old-2' }
      ]
    };

    const updated = updateSessionIdsInTree(tree, new Map([
      ['old-1', 'new-1'],
      ['old-2', 'new-2']
    ]));

    expect(updated?.children?.[0]?.sessionId).toBe('new-1');
    expect(updated?.children?.[1]?.sessionId).toBe('new-2');
  });

  it('should return null when serializing/deserializing empty tree', () => {
    expect(serializeSplitTree(null)).toBeNull();
    expect(deserializeSplitTree(null)).toBeNull();
    expect(updateSessionIdsInTree(null, new Map())).toBeNull();
  });
});
