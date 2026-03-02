export class SplitNode {
  constructor(type = 'leaf', sessionId = null) {
    this.type = type;
    this.ratio = 0.5;
    this.children = null;
    this.sessionId = sessionId;
  }

  isLeaf() {
    return this.type === 'leaf';
  }

  split(direction, newSessionId) {
    if (!this.isLeaf()) return null;

    const oldSessionId = this.sessionId;
    this.type = direction;
    this.sessionId = null;
    this.children = [
      new SplitNode('leaf', oldSessionId),
      new SplitNode('leaf', newSessionId)
    ];
    return this.children[1];
  }
}

export function serializeSplitTree(node) {
  if (!node) return null;
  if (node.isLeaf()) {
    return {
      type: 'leaf',
      sessionId: node.sessionId
    };
  }
  return {
    type: node.type,
    ratio: node.ratio,
    children: [
      serializeSplitTree(node.children[0]),
      serializeSplitTree(node.children[1])
    ]
  };
}

export function deserializeSplitTree(data) {
  if (!data) return null;
  const node = new SplitNode(data.type, data.sessionId || null);
  if (data.type !== 'leaf') {
    node.ratio = data.ratio || 0.5;
    node.children = [
      deserializeSplitTree(data.children[0]),
      deserializeSplitTree(data.children[1])
    ];
  }
  return node;
}

export function updateSessionIdsInTree(node, idMap) {
  if (!node) return null;

  const deserializedNode = deserializeSplitTree(node);

  function updateNode(n) {
    if (!n) return null;

    if (n.isLeaf()) {
      if (n.sessionId && idMap.has(n.sessionId)) {
        n.sessionId = idMap.get(n.sessionId);
      }
    } else if (n.children) {
      n.children[0] = updateNode(n.children[0]);
      n.children[1] = updateNode(n.children[1]);
    }

    return n;
  }

  return updateNode(deserializedNode);
}

export function findLeafNode(node, sessionId) {
  if (!node) return null;
  if (node.isLeaf()) {
    return node.sessionId === sessionId ? node : null;
  }
  return findLeafNode(node.children[0], sessionId) ||
         findLeafNode(node.children[1], sessionId);
}

export function removeLeafNode(node, sessionId) {
  if (!node) return false;

  if (node.isLeaf()) {
    return node.sessionId === sessionId;
  }

  for (let i = 0; i < 2; i++) {
    if (node.children[i].isLeaf() && node.children[i].sessionId === sessionId) {
      const otherChild = node.children[1 - i];
      node.type = otherChild.type;
      node.sessionId = otherChild.sessionId;
      node.children = otherChild.children;
      node.ratio = otherChild.ratio;
      return true;
    }
  }

  return removeLeafNode(node.children[0], sessionId) ||
         removeLeafNode(node.children[1], sessionId);
}

export function getAllLeafNodes(node) {
  if (!node) return [];
  if (node.isLeaf()) return [node];
  return [
    ...getAllLeafNodes(node.children[0]),
    ...getAllLeafNodes(node.children[1])
  ];
}

export function getSplitBranchLabel(nodeType) {
  return nodeType === 'horizontal' ? '가로 분할' : '세로 분할';
}
