import { useState, useMemo, useRef } from "react";
import { ChevronDown, ChevronRight, FileCode2, Folder, Search, FileDiff } from "lucide-react";

interface DiffFile {
  header: string;
  filename: string;
  hunks: DiffHunk[];
}

interface DiffHunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "del" | "context" | "hunk";
  content: string;
  oldLine?: number;
  newLine?: number;
}

function parseDiff(raw: string): DiffFile[] {
  const files: DiffFile[] = [];
  if (!raw) return files;
  const lines = raw.split("\n");
  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      const match = line.match(/b\/(.+)$/);
      current = { header: line, filename: match?.[1] ?? "unknown", hunks: [] };
      files.push(current);
      currentHunk = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) continue;

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = match ? parseInt(match[1], 10) : 0;
      newLine = match ? parseInt(match[2], 10) : 0;
      currentHunk = { header: line, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }

    if (!currentHunk) continue;

    if (line.startsWith("+")) {
      currentHunk.lines.push({ type: "add", content: line.slice(1), newLine: newLine++ });
    } else if (line.startsWith("-")) {
      currentHunk.lines.push({ type: "del", content: line.slice(1), oldLine: oldLine++ });
    } else {
      currentHunk.lines.push({
        type: "context",
        content: line.startsWith(" ") ? line.slice(1) : line,
        oldLine: oldLine++,
        newLine: newLine++,
      });
    }
  }
  return files;
}

function FileStats({ hunks, compact = false }: { hunks: DiffHunk[]; compact?: boolean }) {
  let adds = 0,
    dels = 0;
  for (const h of hunks)
    for (const l of h.lines) {
      if (l.type === "add") adds++;
      if (l.type === "del") dels++;
    }

  if (compact) {
    return (
      <div className="flex gap-1 text-[9px] font-black">
        <span className="text-ok">+{adds}</span>
        <span className="text-err">-{dels}</span>
      </div>
    );
  }

  return (
    <span className="flex items-center gap-2 text-[11px] font-bold">
      <span className="text-ok">+{adds}</span>
      <span className="text-err">-{dels}</span>
    </span>
  );
}

interface FileTreeNode {
  name: string;
  fullName: string;
  type: "file" | "dir";
  children: Record<string, FileTreeNode>;
  fileIdx?: number;
}

function buildFileTree(files: DiffFile[]): FileTreeNode {
  const root: FileTreeNode = { name: "root", fullName: "", type: "dir", children: {} };
  files.forEach((file, idx) => {
    const parts = file.filename.split("/");
    let current = root;
    let path = "";
    parts.forEach((part, i) => {
      path = path ? `${path}/${part}` : part;
      const isLast = i === parts.length - 1;
      if (!current.children[part]) {
        current.children[part] = {
          name: part,
          fullName: path,
          type: isLast ? "file" : "dir",
          children: {},
          fileIdx: isLast ? idx : undefined,
        };
      }
      current = current.children[part];
    });
  });
  return root;
}

function getOrderedFileIndices(node: FileTreeNode): number[] {
  const indices: number[] = [];
  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const child of sortedChildren) {
    if (child.type === "file" && child.fileIdx !== undefined) {
      indices.push(child.fileIdx);
    } else {
      indices.push(...getOrderedFileIndices(child));
    }
  }
  return indices;
}

export function DiffViewer({ diff }: { diff: string | null }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<number, boolean>>({});

  const allFiles = useMemo(() => parseDiff(diff || ""), [diff]);
  const tree = useMemo(() => buildFileTree(allFiles), [allFiles]);
  const orderedIndices = useMemo(() => getOrderedFileIndices(tree), [tree]);

  if (!diff) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-txt-muted">
        <FileDiff size={40} className="mb-4 opacity-20" />
        <p className="text-sm font-bold uppercase tracking-widest">No changes captured</p>
      </div>
    );
  }

  const scrollToFile = (idx: number) => {
    // Expand file if it was collapsed
    if (collapsedFiles[idx]) {
      setCollapsedFiles((prev) => ({ ...prev, [idx]: false }));
    }

    // We need a small timeout to let the DOM update if we just expanded
    setTimeout(() => {
      const element = document.getElementById(`diff-file-${idx}`);
      if (element && scrollContainerRef.current) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 0);
  };

  const toggleCollapse = (idx: number) => {
    setCollapsedFiles((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  return (
    <div className="flex h-full overflow-hidden bg-surface-1/20">
      {/* Sidebar Tree */}
      <aside className="w-64 flex-shrink-0 border-r border bg-surface-2/30 flex flex-col overflow-hidden">
        <div className="p-3 border-b border bg-surface-3/20">
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-txt-muted">
              Files
            </span>
            <span className="text-[9px] font-black text-primary uppercase">{allFiles.length}</span>
          </div>
          <div className="relative">
            <Search
              size={10}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-txt-muted"
            />
            <input
              type="text"
              placeholder="Filter..."
              className="w-full h-7 rounded bg-surface-3 border pl-7 pr-2 text-[10px] font-bold text-txt-base focus:border-primary/50 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 custom-scrollbar">
          <TreeRenderer node={tree} onSelect={scrollToFile} allFiles={allFiles} />
        </div>
      </aside>

      {/* Main Diff Content */}
      <main
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto custom-scrollbar scroll-smooth"
      >
        {orderedIndices.map((idx) => {
          const file = allFiles[idx];
          const isCollapsed = collapsedFiles[idx];
          return (
            <div
              key={idx}
              id={`diff-file-${idx}`}
              className="border-b border last:border-b-0 animate-fade-in"
            >
              <div
                onClick={() => toggleCollapse(idx)}
                className="sticky top-0 z-10 flex items-center justify-between bg-surface-2 px-4 py-2 border-b border shadow-md cursor-pointer group hover:bg-surface-3 transition-colors"
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <div
                    className="transition-transform duration-200"
                    style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
                  >
                    <ChevronDown size={12} className="text-txt-muted" />
                  </div>
                  <FileCode2 size={14} className="text-primary flex-shrink-0" />
                  <span className="text-[11px] font-black text-txt-base truncate tracking-tight">
                    {file.filename}
                  </span>
                </div>
                <FileStats hunks={file.hunks} />
              </div>

              {!isCollapsed && (
                <div className="bg-black/10">
                  <table className="diff-table">
                    <tbody>
                      {file.hunks.map((hunk, hi) => (
                        <HunkRows key={hi} hunk={hunk} />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </main>
    </div>
  );
}

function TreeRenderer({
  node,
  onSelect,
  allFiles,
  depth = 0,
}: {
  node: FileTreeNode;
  onSelect: (idx: number) => void;
  allFiles: DiffFile[];
  depth?: number;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }));

  const sortedChildren = Object.values(node.children).sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-0.5">
      {sortedChildren.map((child) => {
        const isDir = child.type === "dir";
        const isExp = expanded[child.name] ?? true;

        return (
          <div key={child.fullName}>
            <button
              onClick={() =>
                isDir ? toggle(child.name) : child.fileIdx !== undefined && onSelect(child.fileIdx)
              }
              style={{ paddingLeft: `${depth * 10 + 8}px` }}
              className="group flex w-full items-center gap-2 rounded py-1 pr-2 transition-colors hover:bg-surface-3 text-txt-secondary hover:text-txt-base"
            >
              <div className="flex-shrink-0">
                {isDir ? (
                  isExp ? (
                    <ChevronDown size={10} className="opacity-40" />
                  ) : (
                    <ChevronRight size={10} className="opacity-40" />
                  )
                ) : (
                  <div className="h-1 w-1 rounded-full bg-primary/30" />
                )}
              </div>
              {isDir ? (
                <Folder size={12} className="text-primary/50" />
              ) : (
                <FileCode2 size={12} className="text-txt-muted" />
              )}
              <span className="flex-1 truncate text-left text-[10px] font-bold">{child.name}</span>
              {!isDir && child.fileIdx !== undefined && (
                <FileStats hunks={allFiles[child.fileIdx].hunks} compact />
              )}
            </button>
            {isDir && isExp && (
              <TreeRenderer
                node={child}
                onSelect={onSelect}
                allFiles={allFiles}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function HunkRows({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      <tr className="diff-hunk">
        <td colSpan={3} className="px-4 py-1.5 text-[10px] font-black">
          {hunk.header}
        </td>
      </tr>
      {hunk.lines.map((line, i) => {
        const cls =
          line.type === "add" ? "diff-add" : line.type === "del" ? "diff-del" : "diff-context";
        const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
        return (
          <tr key={i} className={`${cls} transition-colors hover:bg-white/5`}>
            <td className="diff-ln !min-w-[40px] !pr-2">{line.oldLine ?? ""}</td>
            <td className="diff-ln !min-w-[40px] !pr-2">{line.newLine ?? ""}</td>
            <td className="diff-code !px-2">
              <span
                className={`select-none mr-2 inline-block w-2 font-black ${line.type === "add" ? "text-ok" : line.type === "del" ? "text-err" : "text-txt-muted opacity-30"}`}
              >
                {prefix}
              </span>
              <span className="opacity-90">{line.content}</span>
            </td>
          </tr>
        );
      })}
    </>
  );
}
