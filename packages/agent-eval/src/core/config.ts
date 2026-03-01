import { createJiti } from "jiti";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { AgentEvalConfig, RunnerConfig } from "./types.js";
import type { IRunnerPlugin } from "./interfaces.js";
import { validatePlugins, formatPluginErrors } from "./plugin-validator.js";

const CONFIG_FILENAMES = ["agenteval.config.ts", "agenteval.config.js", "agenteval.config.mjs"];

const DEFAULT_CONFIG: Partial<AgentEvalConfig> = {
  testFiles: "**/*.{eval,agent-eval}.{ts,js,mts,mjs}",
  outputDir: ".agenteval",
  timeout: 300_000,
};

/**
 * Check if a runner config is a plain CLI runner object: { name, command }.
 */
function isCLIRunnerConfig(r: RunnerConfig): r is import("./types.js").CLIRunnerConfig {
  const obj = r as unknown as Record<string, unknown>;
  return (
    typeof r === "object" &&
    r !== null &&
    "command" in obj &&
    typeof obj.command === "string" &&
    !("execute" in obj)
  );
}

/**
 * Check if a runner config is a plain API runner object: { name, model }.
 */
function isAPIRunnerConfig(r: RunnerConfig): r is import("./types.js").APIRunnerConfig {
  const obj = r as unknown as Record<string, unknown>;
  return (
    typeof r === "object" &&
    r !== null &&
    "model" in obj &&
    typeof obj.model === "object" &&
    !("execute" in obj)
  );
}

/**
 * Resolve runner configs (plain objects) into IRunnerPlugin instances.
 * Also validates that all runner names are unique.
 *
 * - `{ name, command }` → CLIRunner
 * - `{ name, model }` → APIRunner
 * - IRunnerPlugin → used as-is
 *
 * @throws Error if duplicate runner names are found
 */
export async function resolveRunners(configs: RunnerConfig[]): Promise<IRunnerPlugin[]> {
  const resolved: IRunnerPlugin[] = [];
  const names = new Set<string>();

  for (const cfg of configs) {
    let plugin: IRunnerPlugin;

    if (isCLIRunnerConfig(cfg)) {
      const { CLIRunner } = (await import("../runner/plugins/cli.js")) as {
        CLIRunner: new (opts: { name: string; command: string }) => IRunnerPlugin;
      };
      plugin = new CLIRunner({ name: cfg.name, command: cfg.command });
    } else if (isAPIRunnerConfig(cfg)) {
      const { APIRunner } = (await import("../runner/plugins/api.js")) as {
        APIRunner: new (opts: {
          name: string;
          model: import("./interfaces.js").IModelPlugin;
        }) => IRunnerPlugin;
      };
      plugin = new APIRunner({ name: cfg.name, model: cfg.model });
    } else {
      // Already an IRunnerPlugin instance
      plugin = cfg as IRunnerPlugin;
    }

    if (names.has(plugin.name)) {
      throw new Error(
        `Duplicate runner name "${plugin.name}". Each runner must have a unique name.`,
      );
    }
    names.add(plugin.name);
    resolved.push(plugin);
  }

  return resolved;
}

/**
 * Resolve and load the agenteval config file from the given directory.
 * If an explicit configPath is provided, it is used directly.
 * If no config file is found, returns sensible defaults.
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
    } as AgentEvalConfig;
  }

  const jiti = createJiti(cwd, { interopDefault: true });
  const mod = await jiti.import(resolved);
  const raw = (mod as Record<string, unknown>).default ?? mod;

  return {
    ...DEFAULT_CONFIG,
    rootDir: cwd,
    ...(raw as Partial<AgentEvalConfig>),
  } as AgentEvalConfig;
}

/**
 * Validate all plugins in a loaded config and throw with a descriptive
 * message if any plugin fails validation.
 *
 * Call this after `loadConfig()` to fail fast with actionable errors.
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
