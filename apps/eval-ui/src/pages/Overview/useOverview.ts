import { useEffect, useState, useMemo } from "react";
import { fetchRuns, type LedgerRun, type RunnerStats } from "../../lib/api";
import { useRunSelection } from "../../lib/contexts/RunContext";

export type TimeRange = "24h" | "7d" | "30d" | "90d" | "all";

export const TIME_RANGES: { label: string; value: TimeRange }[] = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "All Time", value: "all" },
];

export function useOverview() {
  const { setSelectedRun } = useRunSelection();
  const [allRuns, setAllRuns] = useState<LedgerRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  useEffect(() => {
    fetchRuns()
      .then(setAllRuns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredRuns = useMemo(() => {
    if (timeRange === "all") return allRuns;
    const now = new Date();
    const threshold = new Date();
    if (timeRange === "24h") threshold.setHours(now.getHours() - 24);
    else if (timeRange === "7d") threshold.setDate(now.getDate() - 7);
    else if (timeRange === "30d") threshold.setDate(now.getDate() - 30);
    else if (timeRange === "90d") threshold.setDate(now.getDate() - 90);
    return allRuns.filter((r) => new Date(r.timestamp) >= threshold);
  }, [allRuns, timeRange]);

  const stats = useMemo(() => {
    const runnerStatsMap = new Map<
      string,
      { totalScore: number; count: number; passCount: number }
    >();
    for (const run of filteredRuns) {
      if (!runnerStatsMap.has(run.agentRunner)) {
        runnerStatsMap.set(run.agentRunner, { totalScore: 0, count: 0, passCount: 0 });
      }
      const s = runnerStatsMap.get(run.agentRunner)!;
      s.totalScore += run.score;
      s.count += 1;
      if (run.status === "PASS" || (!run.status && run.pass)) s.passCount += 1;
    }
    return Array.from(runnerStatsMap.entries()).map(([agentRunner, s]) => ({
      agentRunner,
      totalRuns: s.count,
      avgScore: s.totalScore / s.count,
      passRate: s.passCount / s.count,
    })) as RunnerStats[];
  }, [filteredRuns]);

  const totalRunsCount = filteredRuns.length;
  const passCount = filteredRuns.filter((r) => r.status === "PASS" || (!r.status && r.pass)).length;
  const warnCount = filteredRuns.filter((r) => r.status === "WARN").length;
  const lowScoreCount = filteredRuns.filter(
    (r) => r.status === "FAIL" || (!r.status && !r.pass),
  ).length;
  const avgScore =
    totalRunsCount > 0 ? filteredRuns.reduce((s, r) => s + r.score, 0) / totalRunsCount : 0;
  const recentRuns = [...filteredRuns].slice(0, 8);

  const totalAgentTokens = filteredRuns.reduce(
    (s, r) => s + (r.agentTokenUsage?.totalTokens ?? 0),
    0,
  );
  const totalJudgeTokens = filteredRuns.reduce(
    (s, r) => s + (r.judgeTokenUsage?.totalTokens ?? 0),
    0,
  );
  const totalTokensCount = totalAgentTokens + totalJudgeTokens;
  const avgDuration =
    totalRunsCount > 0 ? filteredRuns.reduce((s, r) => s + r.durationMs, 0) / totalRunsCount : 0;

  const trendData = useMemo(() => buildTrendData(filteredRuns), [filteredRuns]);
  const tokenTrendData = useMemo(() => buildTokenTrendData(filteredRuns), [filteredRuns]);
  const activeRunners = useMemo(
    () => Array.from(new Set(filteredRuns.map((r) => r.agentRunner))),
    [filteredRuns],
  );

  const distributionData = [
    { name: "Above Threshold", value: passCount, color: "hsl(var(--color-ok))" },
    { name: "Needs Review", value: warnCount, color: "hsl(var(--color-warn))" },
    { name: "Below Threshold", value: lowScoreCount, color: "hsl(var(--color-err))" },
  ];

  const intensiveTests = useMemo(() => {
    return [...filteredRuns]
      .sort((a, b) => (b.agentTokenUsage?.totalTokens ?? 0) - (a.agentTokenUsage?.totalTokens ?? 0))
      .slice(0, 3);
  }, [filteredRuns]);

  return {
    loading,
    allRuns,
    totalRunsCount,
    avgScore,
    passCount,
    avgDuration,
    totalTokensCount,
    totalAgentTokens,
    totalJudgeTokens,
    recentRuns,
    trendData,
    tokenTrendData,
    activeRunners,
    distributionData,
    stats,
    intensiveTests,
    timeRange,
    setTimeRange,
    setSelectedRun,
  };
}

/* ─── Helpers ─── */

function buildTrendData(runs: LedgerRun[]) {
  const sorted = [...runs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const grouped = new Map<string, Map<string, number[]>>();
  for (const run of sorted) {
    const date = new Date(run.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(date)) grouped.set(date, new Map());
    const runners = grouped.get(date)!;
    if (!runners.has(run.agentRunner)) runners.set(run.agentRunner, []);
    runners.get(run.agentRunner)!.push(run.score);
  }
  return Array.from(grouped.entries()).map(([date, runners]) => {
    const point: Record<string, string | number> = { date };
    for (const [runner, scores] of runners) {
      point[runner] = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3);
    }
    return point;
  });
}

function buildTokenTrendData(runs: LedgerRun[]) {
  const sorted = [...runs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const grouped = new Map<string, Map<string, number[]>>();
  for (const run of sorted) {
    if (!run.agentTokenUsage) continue;
    const date = new Date(run.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    if (!grouped.has(date)) grouped.set(date, new Map());
    const runners = grouped.get(date)!;
    if (!runners.has(run.agentRunner)) runners.set(run.agentRunner, []);
    runners.get(run.agentRunner)!.push(run.agentTokenUsage.totalTokens);
  }
  return Array.from(grouped.entries()).map(([date, runners]) => {
    const point: Record<string, string | number> = { date };
    for (const [runner, tokens] of runners) {
      point[runner] = Math.round(tokens.reduce((a, b) => a + b, 0) / tokens.length);
    }
    return point;
  });
}
