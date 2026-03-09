#!/usr/bin/env node

import "dotenv/config";
import { resolve, join, extname } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { glob } from "glob";
import pc from "picocolors";
import {
  loadConfig,
  validateRunnerNames,
  assertValidPlugins,
  validateTestsAgainstConfig,
} from "../core/config.js";
import { runTest, dryRunTest } from "../core/runner.js";
import {
  DefaultReporter,
  VerboseReporter,
  SilentReporter,
  CIReporter,
  isCI,
} from "../core/reporter.js";
import type { LedgerEntry } from "../core/types.js";
import * as ledgerModule from "../ledger/ledger.js";
import { createServer } from "node:http";
import { parse as parseUrl } from "node:url";

// Load package.json for version
const pkgPath = existsSync(new URL("../package.json", import.meta.url))
  ? new URL("../package.json", import.meta.url)
  : new URL("../../package.json", import.meta.url);

const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

program.name("agenteval").description("AI coding agent evaluation framework").version(pkg.version);

/**
 * Shared action logic for `run` command.
 */
async function runAction(opts: any): Promise<void> {
  const runStart = Date.now();
  const config = await loadConfig(process.cwd(), opts.config);
  assertValidPlugins(config);
  validateRunnerNames(config.runners);

  // Pick reporter
  let reporter: import("../core/reporter.js").Reporter = new DefaultReporter();
  if (opts.silent) reporter = new SilentReporter();
  else if (opts.verbose) reporter = new VerboseReporter();
  else if (isCI()) reporter = new CIReporter();

  // Discover test files
  const patterns = Array.isArray(config.testFiles) ? config.testFiles : [config.testFiles!];
  const files = await glob(patterns, {
    cwd: config.rootDir,
    absolute: true,
    ignore: ["node_modules/**", "dist/**"],
  });

  if (files.length === 0) {
    console.error(pc.red("No test files found matching pattern: " + config.testFiles));
    process.exit(1);
  }

  const allResults: Array<{
    testId: string;
    runner: string;
    entry: LedgerEntry;
    durationMs: number;
  }> = [];

  try {
    for (const file of files) {
      const relPath = resolve(file).replace(process.cwd() + "/", "");

      // Load tests from file
      const { clearRegisteredTests, getRegisteredTests, initSession } = await import("../index.js");
      clearRegisteredTests();
      initSession(config);

      // Import the test file to register tests
      await import(`file://${file}?t=${Date.now()}`);
      let tests = getRegisteredTests();

      // NEW: Upfront validation against config runners
      validateTestsAgainstConfig(tests, config.runners);

      // Apply filters
      if (opts.filter) {
        tests = tests.filter((t) => t.title.toLowerCase().includes(opts.filter.toLowerCase()));
      }
      if (opts.tag) {
        tests = tests.filter((t) => t.tags?.includes(opts.tag));
      }

      if (tests.length === 0) continue;

      if (opts.dryRun) {
        console.log(pc.bold(`\n📄 ${pc.blue(relPath)}`));
        for (const testDef of tests) {
          const plan = await dryRunTest(testDef, config);
          console.log(pc.bold(`\n  🧪 ${pc.yellow(plan.testId)}`));
          console.log(`    Mode:        ${pc.cyan(plan.mode)}`);
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
            `    Runners: ${plan.runners.map((r: { id: string; model: string }) => `${r.id} (${r.model})`).join(", ")}`,
          );
          if (plan.variants && plan.variants.length > 0) {
            console.log(pc.cyan(`    Variants (A/B Test):`));
            for (const v of plan.variants) {
              console.log(`      - [${v.id}] ${v.name} (Runner: ${v.runnerId})`);
            }
          }
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
  .option("--dry-run", "Preview execution plan without running agents")
  .option("-s, --silent", "Suppress all output except errors")
  .option("-v, --verbose", "Show detailed output including judge reasoning")
  .action(runAction);

// ─── Default command shorthand ───
if (process.argv.length === 3 && (process.argv[2] === "." || !process.argv[2].startsWith("-"))) {
  const arg = process.argv[2];
  const KNOWN_COMMANDS = ["run", "ledger", "ui", "view"];
  if (arg && !KNOWN_COMMANDS.includes(arg)) {
    // Treat as `agenteval run` (user typed `agenteval .` or similar)
    process.argv.splice(2, 0, "run");
  }
}

// ─── Ledger command ───

program
  .command("ledger")
  .description("View evaluation results from the ledger")
  .option("--json", "Output full JSON")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(async (opts) => {
    const config = await loadConfig(process.cwd(), opts.config);
    const outputDir = opts.output || config.outputDir || ".agenteval";
    const entries = ledgerModule.readLedger(outputDir);

    if (opts.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    if (entries.length === 0) {
      console.log(pc.yellow("\nNo entries found in the ledger."));
      return;
    }

    console.log(pc.bold("\nLatest Evaluation Results\n"));
    const table = entries.slice(-20).map((e) => ({
      Test: e.testId.slice(0, 30),
      Runner: e.agentRunner,
      Score: e.score.toFixed(2),
      Status: e.status === "PASS" ? pc.green(e.status) : pc.red(e.status),
      Date: new Date(e.timestamp).toLocaleString(),
    }));
    console.table(table);
  });

// ─── UI command ───

program
  .command("ui")
  .alias("view")
  .description("Launch evaluation dashboard")
  .option("-p, --port <port>", "Port to serve on", "4747")
  .option("-o, --output <dir>", "Override ledger directory")
  .action(async (opts) => {
    const config = await loadConfig(process.cwd(), opts.config);
    const outputDir = opts.output || config.outputDir || ".agenteval";
    const port = parseInt(opts.port, 10);
    const ledgerPlugin = config.ledger;

    const ledger = ledgerPlugin || {
      name: "built-in-sqlite",
      getRuns: (testId?: string) =>
        ledgerModule.readLedger(outputDir).filter((r) => !testId || r.testId === testId),
      getTestIds: () => [...new Set(ledgerModule.readLedger(outputDir).map((r) => r.testId))],
      getTags: () => ledgerModule.getTags(outputDir),
      getTestTree: () => ledgerModule.getTestTree(outputDir),
      getStats: (testId?: string) => ledgerModule.getRunnerStats(outputDir, testId),
      overrideRunScore: (runId: number, score: number, reason: string) =>
        ledgerModule.overrideScore(outputDir, runId, score, reason),
      getRunOverrides: (_runId: number) => [], // Minimal implementation for now
    };

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
      console.log(pc.green(`  URL:    http://localhost:${port}\n`));
    } else {
      console.log(pc.yellow(`  API only (UI dist not found)\n`));
    }

    const server = createServer(async (req, res) => {
      // CORS
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      if (req.method === "OPTIONS") {
        res.statusCode = 204;
        res.end();
        return;
      }

      const url = parseUrl(req.url!, true);

      const sendJson = (data: any) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      };

      const readBody = () =>
        new Promise<string>((resolve, reject) => {
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", () => resolve(body));
          req.on("error", reject);
        });

      const handleRequest = async (): Promise<void> => {
        if (url.pathname === "/api/health") {
          sendJson({ status: "ok", ledger: ledger.name });
        } else if (url.pathname === "/api/runs") {
          const testId = url.query.testId as string;
          const entries = await ledger.getRuns(testId);
          sendJson(entries);
        } else if (url.pathname === "/api/tests") {
          const testIds = await ledger.getTestIds();
          sendJson(testIds);
        } else if (url.pathname === "/api/tags") {
          const tags = await ledger.getTags();
          sendJson(tags);
        } else if (url.pathname === "/api/tree") {
          const tree = await ledger.getTestTree();
          sendJson(tree);
        } else if (url.pathname === "/api/stats") {
          const testId = url.query.testId as string;
          const stats = await ledger.getStats(testId);
          sendJson(stats);
        } else if (url.pathname?.match(/^\/api\/runs\/\d+\/override$/)) {
          const runId = parseInt(url.pathname.split("/")[3], 10);
          const body = await readBody();
          const { score, reason } = JSON.parse(body);
          const override = await (ledger as any).overrideRunScore(runId, score, reason);
          sendJson(override);
        } else if (url.pathname?.match(/^\/api\/runs\/\d+\/overrides$/)) {
          const runId = parseInt(url.pathname.split("/")[3], 10);
          const history = await (ledger as any).getRunOverrides(runId);
          sendJson(history);
        } else if (hasUI) {
          // Serve static UI
          let filePath = join(uiDistDir, url.pathname === "/" ? "index.html" : url.pathname!);
          if (!existsSync(filePath)) {
            filePath = join(uiDistDir, "index.html"); // SPA fallback
          }
          const content = readFileSync(filePath);
          const ext = extname(filePath);
          const contentType =
            {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".png": "image/png",
              ".svg": "image/svg+xml",
            }[ext] || "text/plain";

          res.setHeader("Content-Type", contentType);
          res.end(content);
        } else {
          res.statusCode = 404;
          res.end("Not Found");
        }
      };

      try {
        await handleRequest();
      } catch (err: any) {
        res.statusCode = 500;
        sendJson({ error: err.message });
      }
    });

    server.listen(port);
  });

program.parse();
