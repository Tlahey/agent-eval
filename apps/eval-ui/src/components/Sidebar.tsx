import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  FlaskConical,
  Beaker,
  ChevronRight,
  Folder,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchTestTree, type TestTreeNode } from "../lib/api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/runs", icon: ListChecks, label: "All Runs", end: false },
] as const;

export function Sidebar() {
  return (
    <aside className="flex h-full w-[var(--sidebar-width)] flex-col border-r border-border bg-surface-1">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Beaker size={18} className="text-primary" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-txt-base tracking-tight">AgentEval</h1>
          <p className="text-[10px] text-txt-muted">Dashboard</p>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="mt-2 flex flex-col gap-0.5 px-3">
        <span className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
          Navigation
        </span>
        {NAV.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Evals section — populated dynamically */}
      <div className="mt-6 flex flex-1 flex-col overflow-hidden px-3">
        <span className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-txt-muted">
          Evaluations
        </span>
        <div className="flex-1 overflow-y-auto">
          <EvalTree currentPath={location.pathname} />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-border px-5 py-3">
        <p className="text-[10px] text-txt-muted">
          v0.1.0 · <span className="text-ok">●</span> Connected
        </p>
      </div>
    </aside>
  );
}

function EvalTree({ currentPath }: { currentPath: string }) {
  const [tree, setTree] = useState<TestTreeNode[]>([]);

  useEffect(() => {
    fetchTestTree().then(setTree).catch(console.error);
  }, []);

  if (tree.length === 0) {
    return <p className="px-3 py-2 text-xs text-txt-muted italic">No evaluations yet</p>;
  }

  return (
    <div className="flex flex-col gap-0.5">
      {tree.map((node, i) => (
        <TreeNode key={`${node.name}-${i}`} node={node} currentPath={currentPath} depth={0} />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  currentPath,
  depth,
}: {
  node: TestTreeNode;
  currentPath: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(true);

  if (node.type === "test") {
    const to = `/evals/${encodeURIComponent(node.testId ?? node.name)}`;
    const isActive = currentPath === to;
    return (
      <NavLink
        to={to}
        className={`group flex items-center gap-2 rounded-lg py-1.5 text-xs font-medium transition-all ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <FlaskConical size={13} className={isActive ? "text-primary" : "text-txt-muted"} />
        <span className="truncate">{node.name}</span>
      </NavLink>
    );
  }

  // Suite node
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="group flex w-full items-center gap-2 rounded-lg py-1.5 text-xs font-semibold text-txt-muted transition-all hover:bg-surface-3 hover:text-txt-base"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <ChevronRight size={12} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
        <Folder size={13} />
        <span className="truncate">{node.name}</span>
      </button>
      {expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeNode
              key={`${child.name}-${i}`}
              node={child}
              currentPath={currentPath}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
