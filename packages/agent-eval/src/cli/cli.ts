#!/usr/bin/env node

import "dotenv/config";
import { resolve, join, extname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import pc from "picocolors";
import { glob } from "glob";
import { createJiti } from "jiti";
import { loadConfig, assertValidPlugins } from "../core/config.js";
import { getRegisteredTests, clearRegisteredTests, initSession } from "../index.js";
import { runTest, dryRunTest } from "../core/runner.js";
import {
  DefaultReporter,
  SilentReporter,
  VerboseReporter,
  CIReporter,
  isCI,
} from "../core/reporter.js";
import type { Reporter, TestResultEvent } from "../core/reporter.js";
import { setDebug } from "../core/debug.js";
import {
  readLedger,
  readLedgerByTestId,
  getTestIds,
  getTags,
  getTestTree,
  getRunnerStats,
  getAllRunnerStats,
  overrideRunScore,
  getRunOverrides,
} from "../ledger/ledger.js";
import type { ILedgerPlugin } from "../core/interfaces.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8"));

program.name("agenteval").description("AI coding agent evaluation framework").version(pkg.version);

// ─── Ledger resolver (plugin or built-in) ───

/**
 * Build a ledger accessor from config. If config.ledger is set, use the plugin;
 * otherwise fall back to the built-in SQLite functions.
 */
function resolveLedger(
  outputDir: string,
  plugin?: ILedgerPlugin,
): {
  name: string;
  getRuns: (testId?: string) => Promise<unknown[]> | unknown[];
  getTestIds: () => Promise<string[]> | string[];
  getTags: () => Promise<string[]> | string[];
  getTestTree: () => Promise<unknown[]> | unknown[];
  getStats: (testId?: string) => Promise<unknown> | unknown;
  overrideRunScore: (runId: number, score: number, reason: string) => Promise<unknown> | unknown;
  getRunOverrides: (runId: number) => Promise<unknown[]> | unknown[];
} {
  if (plugin) {
    return {
      name: plugin.name,
      getRuns: (testId) => plugin.getRuns(testId),
      getTestIds: () => plugin.getTestIds(),
      getTags: () => plugin.getTags(),
      getTestTree: () => plugin.getTestTree(),
      getStats: (testId) => plugin.getStats(testId),
      overrideRunScore: (runId, score, reason) => plugin.overrideRunScore(runId, score, reason),
      getRunOverrides: (runId) => plugin.getRunOverrides(runId),
    };
  }
  return {
    name: "sqlite (built-in)",
    getRuns: (testId) => (testId ? readLedgerByTestId(outputDir, testId) : readLedger(outputDir)),
    getTestIds: () => getTestIds(outputDir),
    getTags: () => getTags(outputDir),
    getTestTree: () => getTestTree(outputDir),
    getStats: (testId) =>
      testId ? getRunnerStats(outputDir, testId) : getAllRunnerStats(outputDir),
    overrideRunScore: (runId, score, reason) => overrideRunScore(outputDir, runId, score, reason),
    getRunOverrides: (runId) => getRunOverrides(outputDir, runId),
  };
}

// ─── Shared run logic ───

interface RunOptions {
  config?: string;
  filter?: string;
  tag?: string;
  output?: string;
  silent?: boolean;
  verbose?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}

function createReporter(opts: RunOptions): Reporter {
  if (opts.silent) return new SilentReporter();
  if (opts.verbose) return new VerboseReporter();
  if (isCI()) return new CIReporter();
  return new DefaultReporter();
}

async function executeRun(opts: RunOptions): Promise<void> {
  const cwd = process.cwd();
  if (opts.debug) setDebug(true);
  const reporter = createReporter(opts);

  try {
    const config = await loadConfig(cwd, opts.config);
    assertValidPlugins(config);
    if (opts.output) {
      config.outputDir = opts.output;
    }

    initSession(config);
    if (!opts.silent) console.log(pc.green("✓ Config loaded"));

    // Initialize ledger plugin if present
    if (config.ledger) {
      await config.ledger.initialize();
    }

    // Discover test files
    const patterns =
      typeof config.testFiles === "string"
        ? [config.testFiles]
        : (config.testFiles ?? ["**/*.eval.{ts,js,mts,mjs}"]);

    const files = await glob(patterns, {
      cwd,
      ignore: ["node_modules/**", "dist/**"],
      absolute: true,
    });

    if (files.length === 0) {
      if (!opts.silent) console.log(pc.yellow("No test files found."));
      process.exit(0);
    }

    if (!opts.silent) console.log(pc.dim(`Found ${files.length} test file(s)\n`));

    // Load test files sequentially (each file registers tests via test())
    const jiti = createJiti(cwd, { interopDefault: true });

    const allResults: TestResultEvent[] = [];
    const runStart = Date.now();

    for (const file of files) {
      clearRegisteredTests();
      await jiti.import(file);

      let tests = getRegisteredTests();

      // Apply filters
      if (opts.filter) {
        tests = tests.filter((t) => t.title.toLowerCase().includes(opts.filter!.toLowerCase()));
      }
      if (opts.tag) {
        tests = tests.filter((t) => t.tags?.includes(opts.tag!));
      }

      if (tests.length === 0) continue;

      const relPath = file.replace(cwd + "/", "");

      // ─── Dry-run mode: output execution plan without running ───
      if (opts.dryRun) {
        console.log(pc.bold(`\n📄 ${relPath}`));
        for (const testDef of tests) {
          const plan = await dryRunTest(testDef, config);
          const modeIcon =
            plan.mode === "declarative" ? "🔹" : plan.mode === "imperative" ? "🔸" : "❓";
          console.log(`\n  ${modeIcon} ${pc.bold(plan.testId)} ${pc.dim(`(${plan.mode})`)}`);
          if (plan.suitePath && plan.suitePath.length > 0) {
            console.log(`    Suite: ${pc.dim(plan.suitePath.join(" > "))}`);
          }
          if (plan.instruction) {
            console.log(`    Instruction: ${pc.green(`"${plan.instruction}"`)}`);
          }
          if (plan.tasks.length > 0) {
            console.log(`    Tasks:`);
            for (const task of plan.tasks) {
              console.log(
                `      - ${task.name} ${pc.dim(`(weight: ${task.weight})`)} — ${task.criteria}`,
              );
            }
          }
          console.log(
            `    Runners: ${plan.runners.map((r) => `${r.name} (${r.model})`).join(", ")}`,
          );
          if (plan.beforeEachHooks > 0) {
            console.log(`    beforeEach hooks: ${plan.beforeEachHooks}`);
          }
          if (plan.afterEachHooks > 0) {
            console.log(`    afterEach hooks: ${plan.afterEachHooks}`);
          }
        }
        continue;
      }

      reporter.onFileStart(relPath);

      // Count total tests × runners for onRunStart
      const totalRunners = config.runners.length;
      reporter.onRunStart(tests.length, totalRunners);

      // Run each test sequentially
      for (const testDef of tests) {
        const results = await runTest(testDef, config, reporter);
        for (const r of results) {
          allResults.push({
            testId: r.testId,
            runner: r.runner,
            entry: r.entries[0],
            durationMs: r.entries[0].durationMs,
          });
        }
      }
    }

    if (opts.dryRun) {
      console.log(pc.dim("\n✅ Dry run complete. No agents were executed.\n"));
      process.exit(0);
    }

    // Final summary via reporter
    reporter.onRunEnd(allResults, Date.now() - runStart);

    const totalFailed = allResults.filter((r) => !r.entry.pass).length;
    process.exit(totalFailed > 0 ? 1 : 0);
  } catch (err: unknown) {
    console.error(pc.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}

// ─── Run command ───

program
  .command("run")
  .description("Execute evaluation tests")
  .option("-c, --config <path>", "Path to config file")
  .option("-f, --filter <pattern>", "Filter tests by title (substring match)")
  .option("-t, --tag <tag>", "Filter tests by tag")
  .option("-o, --output <dir>", "Override output directory for the ledger database")
  .option("-s, --silent", "Suppress all output except errors")
  .option("-v, --verbose", "Show detailed output including judge reasoning")
  .option("--debug", "Show debug output (CLI judge raw output, token sizes, etc.)")
  .option("--dry-run", "Output the execution plan without running agents or judges")
  .action(executeRun);

// ─── Ledger command ───

program
  .command("ledger")
  .description("View the evaluation ledger")
  .option("--json", "Output as JSON")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(async (opts) => {
    const cwd = process.cwd();
    let outputDir: string;
    let ledgerPlugin: ILedgerPlugin | undefined;

    if (opts.output) {
      outputDir = resolve(cwd, opts.output);
    } else {
      const config = await loadConfig(cwd);
      assertValidPlugins(config);
      outputDir = resolve(cwd, config.outputDir ?? ".agenteval");
      ledgerPlugin = config.ledger;
    }

    const ledger = resolveLedger(outputDir, ledgerPlugin);

    // Initialize ledger (plugin or built-in)
    if (ledgerPlugin) {
      await ledgerPlugin.initialize();
    }

    const entries = (await ledger.getRuns()) as {
      pass: boolean;
      score: number;
      testId: string;
      agentRunner: string;
      timestamp: string;
    }[];

    if (entries.length === 0) {
      console.log(pc.yellow("No ledger entries found."));
      return;
    }

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    const testIds = await ledger.getTestIds();
    console.log(pc.bold(`Ledger: ${entries.length} entries, ${testIds.length} unique tests\n`));

    for (const entry of entries.slice(-20)) {
      const icon = entry.pass ? pc.green("✓") : pc.red("✗");
      const score = pc.yellow(entry.score.toFixed(2));
      const date = new Date(entry.timestamp).toLocaleString();
      console.log(
        `${icon} ${score} ${pc.bold(entry.testId)} [${entry.agentRunner}] ${pc.dim(date)}`,
      );
    }

    if (entries.length > 20) {
      console.log(pc.dim(`\n  ... and ${entries.length - 20} more. Use --json for full output.`));
    }
  });

// ─── UI / View handler ───

interface UiOptions {
  port: string;
  output?: string;
}

async function launchDashboard(opts: UiOptions): Promise<void> {
  const cwd = process.cwd();
  let outputDir: string;
  let ledgerPlugin: ILedgerPlugin | undefined;

  if (opts.output) {
    outputDir = resolve(cwd, opts.output);
  } else {
    const config = await loadConfig(cwd);
    assertValidPlugins(config);
    outputDir = resolve(cwd, config.outputDir ?? ".agenteval");
    ledgerPlugin = config.ledger;
  }

  const ledger = resolveLedger(outputDir, ledgerPlugin);

  // Initialize ledger (plugin or built-in)
  if (ledgerPlugin) {
    await ledgerPlugin.initialize();
  }

  const port = parseInt(opts.port, 10);

  // Resolve the bundled UI static files directory
  const __dirname = fileURLToPath(new URL(".", import.meta.url));
  const uiDistDir = join(__dirname, "ui");
  const hasUI = existsSync(join(uiDistDir, "index.html"));

  console.log(pc.bold("🧪 AgentEval Dashboard\n"));
  console.log(pc.dim(`  Ledger: ${ledger.name}`));
  if (!ledgerPlugin) {
    console.log(pc.dim(`  Path:   ${outputDir}/ledger.sqlite`));
  }
  console.log(pc.dim(`  Port:   ${port}`));
  if (hasUI) {
    console.log(pc.dim(`  UI:     bundled (serving static files)`));
  } else {
    console.log(pc.dim(`  UI:     not bundled (API-only mode)`));
  }
  console.log();

  const MIME_TYPES: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  const { createServer } = await import("node:http");

  const server = createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Content-Type", "application/json");

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    const url = new URL(req.url ?? "/", `http://localhost:${port}`);

    // Helper to read JSON body
    const readBody = (): Promise<string> =>
      new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => resolve(Buffer.concat(chunks).toString()));
        req.on("error", reject);
      });

    const handleRequest = async (): Promise<void> => {
      if (url.pathname === "/api/health") {
        res.end(JSON.stringify({ status: "ok", ledger: ledger.name }));
      } else if (url.pathname === "/api/runs") {
        const testId = url.searchParams.get("testId");
        const entries = await ledger.getRuns(testId ?? undefined);
        res.end(JSON.stringify(entries));
      } else if (url.pathname === "/api/tests") {
        res.end(JSON.stringify(await ledger.getTestIds()));
      } else if (url.pathname === "/api/tags") {
        res.end(JSON.stringify(await ledger.getTags()));
      } else if (url.pathname === "/api/tree") {
        res.end(JSON.stringify(await ledger.getTestTree()));
      } else if (url.pathname === "/api/stats") {
        const testId = url.searchParams.get("testId");
        const stats = await ledger.getStats(testId ?? undefined);
        res.end(JSON.stringify(stats));
      } else if (req.method === "PATCH" && /^\/api\/runs\/\d+\/override$/.test(url.pathname)) {
        const runId = parseInt(url.pathname.split("/")[3], 10);
        const raw = await readBody();
        const body = JSON.parse(raw) as { score?: number; reason?: string };
        if (typeof body.score !== "number" || typeof body.reason !== "string") {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: "score (number) and reason (string) are required" }));
          return;
        }
        const result = await ledger.overrideRunScore(runId, body.score, body.reason);
        res.end(JSON.stringify(result));
      } else if (hasUI && !url.pathname.startsWith("/api")) {
        // Serve static UI files (SPA fallback)
        let filePath = join(uiDistDir, url.pathname === "/" ? "index.html" : url.pathname);
        if (!existsSync(filePath)) {
          filePath = join(uiDistDir, "index.html"); // SPA fallback
        }
        try {
          const content = readFileSync(filePath);
          const ext = extname(filePath);
          res.setHeader("Content-Type", MIME_TYPES[ext] ?? "application/octet-stream");
          res.end(content);
        } catch {
          res.statusCode = 404;
          res.end("Not found");
        }
      } else {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "Not found" }));
      }
    };

    handleRequest().catch((err: unknown) => {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    });
  });

  server.listen(port, () => {
    console.log(pc.green(`  ✓ Dashboard running at http://localhost:${port}`));
    console.log(pc.dim(`\n  Endpoints:`));
    console.log(pc.dim(`    GET   /api/runs           All runs (or ?testId=...)`));
    console.log(pc.dim(`    GET   /api/tests          List of test IDs`));
    console.log(pc.dim(`    GET   /api/tags           List of unique tags`));
    console.log(pc.dim(`    GET   /api/tree           Hierarchical test tree`));
    console.log(pc.dim(`    GET   /api/stats          Aggregate stats per runner`));
    console.log(pc.dim(`    PATCH /api/runs/:id/override  Override a run score`));

    console.log(pc.dim(`\n  Press Ctrl+C to stop.\n`));
  });
}

program
  .command("ui")
  .description("Launch the evaluation dashboard")
  .option("-p, --port <port>", "Port to serve on", "4747")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(launchDashboard);

// `view` is an alias for `ui`
program
  .command("view")
  .description("Launch the evaluation dashboard (alias for ui)")
  .option("-p, --port <port>", "Port to serve on", "4747")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(launchDashboard);

// ─── Default command: treat unknown args as `run` ───

const KNOWN_COMMANDS = ["run", "ledger", "ui", "view", "help", "--help", "-h", "--version", "-V"];

// If no command is given (e.g., `agenteval` or `agenteval .`), default to `run`
if (process.argv.length <= 2 || (process.argv.length === 3 && !process.argv[2].startsWith("-"))) {
  const arg = process.argv[2];
  if (arg && !KNOWN_COMMANDS.includes(arg)) {
    // Treat as `agenteval run` (user typed `agenteval .` or similar)
    process.argv.splice(2, 0, "run");
  }
}

program.parse();
