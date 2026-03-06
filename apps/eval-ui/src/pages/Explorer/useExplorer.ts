import { useEffect, useState, useMemo } from "react";
import {
  fetchTestTree,
  fetchTags,
  fetchRuns,
  type TestTreeNode,
  type LedgerRun,
} from "../../lib/api";

export interface TestMetrics {
  topRunners: { name: string; avgScore: number }[];
  runCount: number;
  agentCount: number;
  avgScore: number;
  rank?: number;
}

export function useExplorer() {
  const [tree, setTestTree] = useState<TestTreeNode[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [allRuns, setAllRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [treeKey, setTreeKey] = useState(0);
  const [forceExpand, setForceExpand] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const results = await Promise.allSettled([fetchTestTree(), fetchTags(), fetchRuns()]);

      if (cancelled) return;

      if (results[0].status === "fulfilled") setTestTree(results[0].value || []);
      if (results[1].status === "fulfilled") setTags(results[1].value || []);
      if (results[2].status === "fulfilled") setAllRuns(results[2].value || []);

      setLoading(false);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // Compute metrics and ranking
  const metricsMap = useMemo(() => {
    const map = new Map<string, TestMetrics>();
    const testIds = [...new Set(allRuns.map((r) => r.testId))];

    const results: { testId: string; avgScore: number }[] = [];

    for (const id of testIds) {
      const testRuns = allRuns.filter((r) => r.testId === id);
      if (testRuns.length === 0) continue;

      const runnerStats = new Map<string, { total: number; count: number }>();
      let totalTestScore = 0;

      for (const r of testRuns) {
        const score = r.override ? r.override.score : r.score;
        totalTestScore += score;
        const s = runnerStats.get(r.agentRunner) || { total: 0, count: 0 };
        s.total += score;
        s.count += 1;
        runnerStats.set(r.agentRunner, s);
      }

      const avgScore = totalTestScore / testRuns.length;
      results.push({ testId: id, avgScore });

      const topRunners = Array.from(runnerStats.entries())
        .map(([name, s]) => ({ name, avgScore: s.total / s.count }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 3);

      map.set(id, {
        avgScore,
        topRunners,
        runCount: testRuns.length,
        agentCount: runnerStats.size,
      });
    }

    // Assign ranks based on avgScore
    results.sort((a, b) => b.avgScore - a.avgScore);
    results.forEach((res, index) => {
      const m = map.get(res.testId);
      if (m) m.rank = index + 1;
    });

    return map;
  }, [allRuns]);

  // Filter the tree based on search and tags
  const filteredTree = useMemo(() => {
    if (!search && !tagFilter) return tree;

    const filterNode = (node: TestTreeNode): TestTreeNode | null => {
      if (node.type === "test") {
        const matchesSearch = !search || node.name.toLowerCase().includes(search.toLowerCase());
        const nodeTags = Array.isArray(node.tags) ? node.tags : [];
        const matchesTag = !tagFilter || nodeTags.includes(tagFilter);
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
    metricsMap,
  };
}
