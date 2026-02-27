import { createJiti } from "jiti";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { AgentEvalConfig } from "./types.js";

const CONFIG_FILENAMES = ["agenteval.config.ts", "agenteval.config.js", "agenteval.config.mjs"];

const DEFAULT_CONFIG: Partial<AgentEvalConfig> = {
  testFiles: "**/*.{eval,agent-eval}.{ts,js,mts,mjs}",
  outputDir: ".agenteval",
  timeout: 300_000,
};

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
      judge: { provider: "openai", model: "gpt-4o" },
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
 * Helper to define config with type-safety.
 */
export function defineConfig(config: AgentEvalConfig): AgentEvalConfig {
  return config;
}
