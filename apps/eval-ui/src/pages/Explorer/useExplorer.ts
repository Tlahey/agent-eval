import { useEffect, useState, useMemo } from "react";
import { fetchTestTree, fetchTags, type TestTreeNode } from "../../lib/api";

export function useExplorer() {
  const [tree, setTestTree] = useState<TestTreeNode[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [forceExpand, setForceExpand] = useState<boolean | null>(null);
  const [treeKey, setTreeKey] = useState(0);

  useEffect(() => {
    Promise.all([fetchTestTree(), fetchTags()])
      .then(([treeData, tagsData]) => {
        setTestTree(treeData);
        setTags(tagsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Filter the tree based on search and tags
  const filteredTree = useMemo(() => {
    if (!search && !tagFilter) return tree;

    const filterNode = (node: TestTreeNode): TestTreeNode | null => {
      if (node.type === "test") {
        const matchesSearch = !search || node.name.toLowerCase().includes(search.toLowerCase());
        const matchesTag = !tagFilter || (node.tags && node.tags.includes(tagFilter));
        return matchesSearch && matchesTag ? node : null;
      }

      if (node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter((n): n is TestTreeNode => n !== null);

        if (filteredChildren.length > 0) {
          return { ...node, children: filteredChildren };
        }
      }

      return null;
    };

    return tree.map(filterNode).filter((n): n is TestTreeNode => n !== null);
  }, [tree, search, tagFilter]);

  const expandAll = () => {
    setForceExpand(true);
    setTreeKey((k) => k + 1);
  };

  const collapseAll = () => {
    setForceExpand(false);
    setTreeKey((k) => k + 1);
  };

  return {
    loading,
    tree: filteredTree,
    tags,
    tagFilter,
    setTagFilter,
    search,
    setSearch,
    expandAll,
    collapseAll,
    forceExpand,
    treeKey,
  };
}
