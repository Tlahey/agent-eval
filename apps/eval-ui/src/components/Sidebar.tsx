import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  FlaskConical,
  Beaker,
  ChevronRight,
  Folder,
  Palette,
  Check,
} from "lucide-react";
import { useEffect, useState } from "react";
import { fetchTestTree, type TestTreeNode } from "../lib/api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview", end: true },
  { to: "/evaluations", icon: FlaskConical, label: "Evaluations", end: false },
  { to: "/runs", icon: ListChecks, label: "All Runs", end: false },
] as const;

type Theme =
  | "nebula"
  | "nord"
  | "clean-blue"
  | "light"
  | "high-contrast"
  | "solarized-light"
  | "cyber-neon"
  | "terra"
  | "admiral"
  | "energy";

const THEMES: { id: Theme; label: string; colors: string[] }[] = [
  { id: "nebula", label: "Nebula Midnight", colors: ["#BD93F9", "#FF79C6"] },
  { id: "nord", label: "Nord Frost", colors: ["#88C0D0", "#81A1C1"] },
  { id: "clean-blue", label: "Clean Blue", colors: ["#3F72AF", "#112D4E"] },
  { id: "light", label: "Pure Light", colors: ["#007ACC", "#FFFFFF"] },
  { id: "high-contrast", label: "High Contrast", colors: ["#FFFF00", "#00FFFF"] },
  { id: "solarized-light", label: "Solarized Light", colors: ["#fdf6e3", "#268bd2"] },
  { id: "cyber-neon", label: "Cyber Neon", colors: ["#A855F7", "#06B6D4"] },
  { id: "terra", label: "Terra Earth", colors: ["#2D5A27", "#A64B2A"] },
  { id: "admiral", label: "Admiral Navy", colors: ["#192231", "#490E0E"] },
  { id: "energy", label: "Vibrant Energy", colors: ["#FF4E00", "#00BFFF"] },
];

export function Sidebar() {
  const location = useLocation();
  const [currentTheme, setCurrentTheme] = useState<Theme>(
    (localStorage.getItem("agent-eval-theme") as Theme) || "nebula",
  );
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    if (currentTheme === "nebula") {
      html.removeAttribute("data-theme");
    } else {
      html.setAttribute("data-theme", currentTheme);
    }
    localStorage.setItem("agent-eval-theme", currentTheme);
  }, [currentTheme]);

  return (
    <aside className="relative flex h-full w-[var(--sidebar-width)] flex-shrink-0 flex-col bg-surface-0 p-4">
      <div className="flex h-full flex-col overflow-hidden rounded-2xl border bg-surface-1/50 backdrop-blur-xl shadow-2xl shadow-black/20">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-8">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent p-[1px] shadow-lg shadow-primary/20">
            <div className="flex h-full w-full items-center justify-center rounded-[11px] bg-surface-1">
              <Beaker size={20} className="text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold text-txt-base tracking-tight">AgentEval</h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-primary opacity-80">
              v0.1.0
            </p>
          </div>
        </div>

        {/* Main Nav */}
        <nav className="space-y-1 px-3">
          <span className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-txt-muted/60">
            Main
          </span>
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-primary text-txt-onprimary shadow-lg shadow-primary/20"
                    : "text-txt-secondary hover:bg-surface-2 hover:text-txt-base"
                }`
              }
            >
              <Icon size={18} className="transition-transform group-hover:scale-110" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Evals section */}
        <div className="mt-8 flex flex-1 flex-col overflow-hidden px-3">
          <span className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-txt-muted/60">
            Tree View
          </span>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
            <EvalTree currentPath={location.pathname} />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-auto border-t bg-surface-2/30 p-3">
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex w-full items-center justify-between rounded-xl border bg-surface-1/50 px-4 py-2.5 text-xs font-bold text-txt-secondary transition-all hover:border-primary/30 hover:bg-surface-1"
            >
              <div className="flex items-center gap-2.5">
                <Palette size={16} className="text-primary" />
                <span className="capitalize">{currentTheme.replace("-", " ")}</span>
              </div>
              <ChevronRight
                size={14}
                className={`text-txt-muted transition-transform ${showThemeMenu ? "-rotate-90" : "rotate-90"}`}
              />
            </button>

            {showThemeMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowThemeMenu(false)} />
                <div className="absolute bottom-full left-0 z-20 mb-2 w-full origin-bottom rounded-2xl border bg-surface-1 p-1.5 shadow-2xl animate-scale-in">
                  {THEMES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setCurrentTheme(t.id);
                        setShowThemeMenu(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-all ${
                        currentTheme === t.id
                          ? "bg-primary text-txt-onprimary shadow-lg shadow-primary/20"
                          : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex -space-x-1">
                          {t.colors.map((c, i) => (
                            <div
                              key={i}
                              className="h-3 w-3 rounded-full border border-line/20"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                        {t.label}
                      </div>
                      {currentTheme === t.id && <Check size={14} />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
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
    return (
      <div className="px-4 py-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-widest text-txt-muted/40">
          No evaluations yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 py-2">
      {tree.map((node, i) => (
        <TreeNode key={i} node={node} currentPath={currentPath} />
      ))}
    </div>
  );
}

function TreeNode({
  node,
  currentPath,
  depth = 0,
}: {
  node: TestTreeNode;
  currentPath: string;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isTest = node.type === "test";
  const to = `/evals/${encodeURIComponent(node.testId ?? node.name)}`;
  const isActive = currentPath === to;

  if (isTest) {
    return (
      <NavLink
        to={to}
        title={node.name}
        className={`group flex items-center gap-2 rounded-lg py-1.5 text-xs font-medium transition-all ${
          isActive
            ? "bg-primary/10 text-primary"
            : "text-txt-secondary hover:bg-surface-3 hover:text-txt-base"
        }`}
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <FlaskConical
          size={13}
          className={`shrink-0 ${isActive ? "text-primary" : "text-txt-muted"}`}
        />
        <span className="truncate flex-1 min-w-0">{node.name}</span>
      </NavLink>
    );
  }

  // Suite node
  return (
    <div className="min-w-0">
      <button
        onClick={() => setExpanded(!expanded)}
        title={node.name}
        className="group flex w-full items-center gap-2 rounded-lg py-1.5 text-xs font-semibold text-txt-muted transition-all hover:bg-surface-3 hover:text-txt-base"
        style={{ paddingLeft: `${depth * 12 + 12}px` }}
      >
        <ChevronRight
          size={12}
          className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
        />
        <Folder size={13} className="shrink-0" />
        <span className="truncate flex-1 text-left min-w-0">{node.name}</span>
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
