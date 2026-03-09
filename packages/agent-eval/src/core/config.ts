import { createJiti } from "jiti";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { AgentEvalConfig, RunnerConfig } from "./types.js";
import { validatePlugins, formatPluginErrors } from "./plugin-validator.js";

const CONFIG_FILENAMES = ["agenteval.config.ts", "agenteval.config.js", "agenteval.config.mjs"];

const DEFAULT_CONFIG: Partial<AgentEvalConfig> = {
  testFiles: "**/*.{eval,agent-eval}.{ts,js,mts,mjs}",
  outputDir: ".agenteval",
  timeout: 300_000,
};

/**
 * Validate that all runner IDs are unique.
 *
 * @throws Error if duplicate runner IDs are found
 */
export function validateRunnerNames(runners: RunnerConfig[]): void {
  const ids = new Set<string>();
  for (const runner of runners) {
    if (ids.has(runner.id)) {
      throw new Error(`Duplicate runner ID "${runner.id}". Each runner must have a unique ID.`);
    }
    ids.add(runner.id);
  }
}

/**
 * Resolve and load the agenteval config file from the given directory.
 */
export async function loadConfig(
  cwd: string = process.cwd(),
  configPath?: string,
): Promise<AgentEvalConfig> {
  let resolved: string | null = configPath ? resolve(cwd, configPath) : null;

  if (!resolved) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = resolve(cwd, filename);
      if (existsSync(candidate)) {
        resolved = candidate;
        break;
      }
    }
  }

  // No config file → return defaults (don't throw)
  if (!resolved) {
    return {
      ...DEFAULT_CONFIG,
      rootDir: cwd,
      runners: [],
      judge: {},
    } as unknown as AgentEvalConfig;
  }

  const jiti = createJiti(cwd, { interopDefault: true });
  const mod = await jiti.import(resolved);
  const raw = (mod as Record<string, unknown>).default ?? mod;

  return {
    ...DEFAULT_CONFIG,
    rootDir: cwd,
    ...(raw as Partial<AgentEvalConfig>),
  } as unknown as AgentEvalConfig;
}

/**
 * Validate that all runners used in tests exist in the config registry.
 */
export function validateTestsAgainstConfig(tests: any[], runners: RunnerConfig[]): void {
  const validIds = new Set(runners.map((r) => r.id));
  const errors: string[] = [];

  for (const test of tests) {
    for (const variant of test.variants || []) {
      if (!validIds.has(variant.runner)) {
        errors.push(
          `Test "${test.title}" uses unknown runner "${variant.runner}" in variant "${variant.name}".`,
        );
      }
    }
  }

  if (errors.length > 0) {
    const available = Array.from(validIds).join(", ") || "none";
    throw new Error(
      `Invalid runner(s) detected in tests:\n- ${errors.join("\n- ")}\n\nAvailable runners in config: ${available}`,
    );
  }
}

/**
 * Validate all plugins in a loaded config.
 */
export function assertValidPlugins(config: AgentEvalConfig): void {
  const errors = validatePlugins(config);
  if (errors.length > 0) {
    throw new Error(formatPluginErrors(errors));
  }
}

/**
 * Helper to define config with type-safety.
 */
export function defineConfig(config: AgentEvalConfig): AgentEvalConfig {
  return config;
}
