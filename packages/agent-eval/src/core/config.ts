import { createJiti } from "jiti";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
import type { AgentEvalConfig } from "./types.js";

const CONFIG_FILENAMES = ["agenteval.config.ts", "agenteval.config.js", "agenteval.config.mjs"];

const DEFAULT_CONFIG: Partial<AgentEvalConfig> = {
  testFiles: "**/*.eval.{ts,js,mts,mjs}",
  outputDir: ".agenteval",
  timeout: 300_000,
};

/**
 * Resolve and load the agenteval config file from the given directory.
 */
export async function loadConfig(cwd: string = process.cwd()): Promise<AgentEvalConfig> {
  let configPath: string | null = null;

  for (const filename of CONFIG_FILENAMES) {
    const candidate = resolve(cwd, filename);
    if (existsSync(candidate)) {
      configPath = candidate;
      break;
    }
  }

  if (!configPath) {
    throw new Error(`No agenteval config found. Create one of: ${CONFIG_FILENAMES.join(", ")}`);
  }

  const jiti = createJiti(cwd, { interopDefault: true });
  const mod = await jiti.import(configPath);
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
