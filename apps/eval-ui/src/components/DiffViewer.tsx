import { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2 } from "lucide-react";

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
  const lines = raw.split("\n");
  let current: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      // Extract filename from "diff --git a/... b/..."
      const match = line.match(/b\/(.+)$/);
      current = { header: line, filename: match?.[1] ?? "unknown", hunks: [] };
      files.push(current);
      currentHunk = null;
      continue;
    }
    if (!current) continue;
    if (line.startsWith("index ") || line.startsWith("---") || line.startsWith("+++")) continue;
    if (
      line.startsWith("new file") ||
      line.startsWith("deleted file") ||
      line.startsWith("old mode") ||
      line.startsWith("new mode")
    )
      continue;

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

function FileStats({ hunks }: { hunks: DiffHunk[] }) {
  let adds = 0,
    dels = 0;
  for (const h of hunks)
    for (const l of h.lines) {
      if (l.type === "add") adds++;
      if (l.type === "del") dels++;
    }
  const total = adds + dels;
  const maxBlocks = 5;
  const addBlocks = total > 0 ? Math.round((adds / total) * maxBlocks) : 0;
  const delBlocks = total > 0 ? maxBlocks - addBlocks : 0;

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-ok">+{adds}</span>
      <span className="text-err">-{dels}</span>
      <span className="flex gap-px">
        {Array.from({ length: addBlocks }).map((_, i) => (
          <span key={`a${i}`} className="inline-block h-2 w-2 rounded-sm bg-ok" />
        ))}
        {Array.from({ length: delBlocks }).map((_, i) => (
          <span key={`d${i}`} className="inline-block h-2 w-2 rounded-sm bg-err" />
        ))}
      </span>
    </span>
  );
}

export function DiffViewer({ diff }: { diff: string | null }) {
  if (!diff) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-txt-muted">
        <FileCode2 size={32} className="mb-2 opacity-40" />
        <p className="text-sm">No diff captured for this run</p>
      </div>
    );
  }

  const files = parseDiff(diff);
  const defaultExpanded = new Set(files.map((_, i) => i));

  return <DiffViewerInner files={files} defaultExpanded={defaultExpanded} />;
}

function DiffViewerInner({
  files,
  defaultExpanded,
}: {
  files: DiffFile[];
  defaultExpanded: Set<number>;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {/* File summary */}
      <div className="rounded-lg border border-border bg-surface-2 p-3">
        <p className="text-xs text-txt-secondary">
          Showing <span className="font-semibold text-txt-base">{files.length}</span> changed file
          {files.length !== 1 ? "s" : ""}
        </p>
      </div>

      {files.map((file, idx) => (
        <div key={idx} className="overflow-hidden rounded-lg border border-border bg-surface-1">
          {/* File header */}
          <div className="diff-file-header" onClick={() => toggle(idx)}>
            {expanded.has(idx) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <FileCode2 size={14} className="text-txt-muted" />
            <span className="flex-1 text-txt-base">{file.filename}</span>
            <FileStats hunks={file.hunks} />
          </div>

          {/* Diff content */}
          {expanded.has(idx) && (
            <div className="overflow-x-auto">
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
      ))}
    </div>
  );
}

function HunkRows({ hunk }: { hunk: DiffHunk }) {
  return (
    <>
      <tr className="diff-hunk">
        <td colSpan={3}>{hunk.header}</td>
      </tr>
      {hunk.lines.map((line, i) => {
        const cls =
          line.type === "add" ? "diff-add" : line.type === "del" ? "diff-del" : "diff-context";
        const prefix = line.type === "add" ? "+" : line.type === "del" ? "-" : " ";
        return (
          <tr key={i} className={cls}>
            <td className="diff-ln">{line.oldLine ?? ""}</td>
            <td className="diff-ln">{line.newLine ?? ""}</td>
            <td className="diff-code">
              <span className="select-none text-txt-muted mr-2">{prefix}</span>
              {line.content}
            </td>
          </tr>
        );
      })}
    </>
  );
}
