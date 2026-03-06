import { useExplorer } from "./useExplorer";
import {
  Folder,
  FlaskConical,
  ChevronRight,
  Search,
  Tag,
  BarChart3,
  ArrowRight,
  FilterX,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { type TestTreeNode } from "../../lib/api";

export function Explorer() {
  const { loading, tree, tags, tagFilter, setTagFilter, search, setSearch } = useExplorer();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent shadow-lg shadow-primary/20" />
      </div>
    );
  }

  const hasFilters = !!(search || tagFilter);

  return (
    <div className="p-8 space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-txt-base tracking-tight mb-1">Evaluations</h1>
          <p className="text-sm text-txt-muted font-bold uppercase tracking-wider">
            Explore your test hierarchy and analyze results
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative group">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-txt-muted group-focus-within:text-primary transition-colors"
            />
            <input
              type="text"
              placeholder="Search tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border bg-surface-2 pl-11 pr-4 text-sm font-bold text-txt-base placeholder:text-txt-muted/50 focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all w-64 shadow-inner"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Sidebar: Filters & Tags */}
        <div className="space-y-6 lg:sticky lg:top-8">
          <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm shadow-xl shadow-black/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-txt-muted flex items-center gap-2">
                <Tag size={14} className="text-primary" />
                Tags
              </h3>
              {tagFilter && (
                <button
                  onClick={() => setTagFilter("")}
                  className="text-[10px] font-bold text-primary hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                      tagFilter === tag
                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                        : "bg-surface-2 text-txt-muted border-transparent hover:border-txt-muted/30"
                    }`}
                  >
                    {tag}
                  </button>
                ))
              ) : (
                <p className="text-[10px] text-txt-muted italic">No tags available</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-surface-1/40 p-6 backdrop-blur-sm shadow-xl shadow-black/5">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-txt-muted mb-4 flex items-center gap-2">
              <BarChart3 size={14} className="text-accent" />
              Hierarchy Stats
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-surface-2/50 border">
                <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                  Total Tests
                </p>
                <p className="text-xl font-black text-txt-base">{countTests(tree)}</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-2/50 border">
                <p className="text-[9px] font-black text-txt-muted uppercase tracking-widest mb-1">
                  Total Suites
                </p>
                <p className="text-xl font-black text-txt-base">{countSuites(tree)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Full Tree List */}
        <div className="lg:col-span-3">
          <div className="rounded-3xl border bg-surface-1/40 backdrop-blur-sm shadow-2xl shadow-black/5 overflow-hidden">
            <div className="bg-surface-2/50 border-b px-8 py-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-txt-muted">
                Test Repository Explorer
              </span>
              {hasFilters && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 uppercase">
                    Filtered View
                  </span>
                </div>
              )}
            </div>

            <div className="p-4">
              {tree.length > 0 ? (
                <div className="divide-y divide-line/5">
                  {tree.map((node, i) => (
                    <RecursiveTreeNode key={i} node={node} depth={0} defaultExpanded={hasFilters} />
                  ))}
                </div>
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-txt-muted mb-4">
                    <FilterX size={32} />
                  </div>
                  <p className="text-txt-base font-black uppercase tracking-widest">
                    No results matched your filters
                  </p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setTagFilter("");
                    }}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    Reset all filters
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecursiveTreeNode({
  node,
  depth,
  defaultExpanded,
}: {
  node: TestTreeNode;
  depth: number;
  defaultExpanded: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand when filters are active to show results
  const expanded = defaultExpanded || isExpanded;

  if (node.type === "suite") {
    return (
      <div className="select-none">
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="group flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-surface-2/50 cursor-pointer transition-colors"
          style={{ paddingLeft: `${depth * 24 + 16}px` }}
        >
          <div
            className={`p-1.5 rounded-lg transition-colors ${expanded ? "bg-primary/10 text-primary" : "bg-surface-3 text-txt-muted group-hover:text-txt-base"}`}
          >
            <Folder size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-txt-base uppercase tracking-tight truncate">
              {node.name}
            </h4>
            <p className="text-[10px] font-medium text-txt-muted uppercase tracking-wider">
              {node.children?.length ?? 0} items
            </p>
          </div>
          <ChevronRight
            size={16}
            className={`text-txt-muted transition-transform duration-300 ${expanded ? "rotate-90" : ""}`}
          />
        </div>

        {expanded && node.children && (
          <div className="relative">
            {/* Thread line */}
            <div
              className="absolute left-0 top-0 bottom-0 w-px bg-line/10"
              style={{ marginLeft: `${depth * 24 + 27}px` }}
            />
            {node.children.map((child, i) => (
              <RecursiveTreeNode
                key={i}
                node={child}
                depth={depth + 1}
                defaultExpanded={defaultExpanded}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      to={`/evals/${encodeURIComponent(node.testId ?? node.name)}`}
      className="group flex items-center gap-3 py-3 px-4 rounded-xl hover:bg-surface-2 transition-colors"
      style={{ paddingLeft: `${depth * 24 + 16}px` }}
    >
      <div className="p-1.5 rounded-lg bg-accent/10 text-accent group-hover:bg-accent group-hover:text-white transition-all">
        <FlaskConical size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-bold text-txt-base uppercase tracking-tight truncate group-hover:text-accent transition-colors">
          {node.name}
        </h4>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {node.tags && node.tags.length > 0 ? (
            node.tags.map((tag) => (
              <span
                key={tag}
                className="text-[8px] font-black text-txt-muted/60 uppercase tracking-widest px-1.5 py-0.5 rounded-md border border-line/10 bg-surface-2 group-hover:border-accent/20 transition-colors"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-[8px] font-bold text-txt-muted/30 uppercase tracking-widest">
              No tags
            </span>
          )}
        </div>
      </div>
      <div className="opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
        <ArrowRight size={16} className="text-accent" />
      </div>
    </Link>
  );
}

function countTests(nodes: TestTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "test") count++;
    if (node.children) count += countTests(node.children);
  }
  return count;
}

function countSuites(nodes: TestTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.type === "suite") {
      count++;
      if (node.children) count += countSuites(node.children);
    }
  }
  return count;
}
