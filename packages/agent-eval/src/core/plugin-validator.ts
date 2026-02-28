/**
 * Plugin validation utilities.
 *
 * Validates that user-provided plugins implement all required interface methods
 * before the framework attempts to use them. Returns human-readable error messages.
 */

/** A single validation error describing a missing or invalid member */
export interface PluginValidationError {
  plugin: string;
  member: string;
  expected: "property" | "method";
  message: string;
}

// ─── Required members per interface ───

const LEDGER_REQUIRED_PROPERTIES = ["name"] as const;
const LEDGER_REQUIRED_METHODS = [
  "initialize",
  "recordRun",
  "getRuns",
  "getRunById",
  "getTestIds",
  "getTestTree",
  "getLatestEntries",
  "getStats",
  "overrideRunScore",
  "getRunOverrides",
] as const;

const LLM_REQUIRED_PROPERTIES = ["name", "provider", "defaultModel"] as const;
const LLM_REQUIRED_METHODS = ["evaluate"] as const;

const JUDGE_REQUIRED_PROPERTIES = ["name"] as const;
const JUDGE_REQUIRED_METHODS = ["judge"] as const;

// ─── Validators ───

function checkMembers(
  obj: unknown,
  pluginLabel: string,
  requiredProps: readonly string[],
  requiredMethods: readonly string[],
): PluginValidationError[] {
  const errors: PluginValidationError[] = [];

  if (obj == null || typeof obj !== "object") {
    errors.push({
      plugin: pluginLabel,
      member: "(self)",
      expected: "property",
      message: `${pluginLabel} must be a non-null object, got ${obj === null ? "null" : typeof obj}`,
    });
    return errors;
  }

  const record = obj as Record<string, unknown>;

  for (const prop of requiredProps) {
    if (!(prop in record) || record[prop] === undefined) {
      errors.push({
        plugin: pluginLabel,
        member: prop,
        expected: "property",
        message: `${pluginLabel} is missing required property '${prop}'`,
      });
    }
  }

  for (const method of requiredMethods) {
    if (typeof record[method] !== "function") {
      errors.push({
        plugin: pluginLabel,
        member: method,
        expected: "method",
        message: `${pluginLabel} is missing required method '${method}()'`,
      });
    }
  }

  return errors;
}

/** Validate that an object satisfies the ILedgerPlugin contract */
export function validateLedgerPlugin(plugin: unknown): PluginValidationError[] {
  return checkMembers(plugin, "LedgerPlugin", LEDGER_REQUIRED_PROPERTIES, LEDGER_REQUIRED_METHODS);
}

/** Validate that an object satisfies the ILLMPlugin contract */
export function validateLLMPlugin(plugin: unknown): PluginValidationError[] {
  return checkMembers(plugin, "LLMPlugin", LLM_REQUIRED_PROPERTIES, LLM_REQUIRED_METHODS);
}

/** Validate that an object satisfies the IJudgePlugin contract */
export function validateJudgePlugin(plugin: unknown): PluginValidationError[] {
  return checkMembers(plugin, "JudgePlugin", JUDGE_REQUIRED_PROPERTIES, JUDGE_REQUIRED_METHODS);
}

/**
 * Validate all plugins in a config object.
 * Returns an array of errors (empty = valid).
 */
export function validatePlugins(config: {
  ledger?: unknown;
  llm?: unknown;
  judge?: unknown;
}): PluginValidationError[] {
  const errors: PluginValidationError[] = [];

  if (config.ledger !== undefined) {
    errors.push(...validateLedgerPlugin(config.ledger));
  }

  if (config.llm !== undefined) {
    errors.push(...validateLLMPlugin(config.llm));
  }

  // Only validate judge if it looks like a plugin (has 'judge' method),
  // not a plain JudgeConfig object (which has 'provider' + 'model')
  if (
    config.judge !== undefined &&
    typeof config.judge === "object" &&
    config.judge !== null &&
    "judge" in config.judge &&
    typeof (config.judge as Record<string, unknown>).judge === "function"
  ) {
    errors.push(...validateJudgePlugin(config.judge));
  }

  return errors;
}

/**
 * Format validation errors into a human-readable string for CLI/UI display.
 */
export function formatPluginErrors(errors: PluginValidationError[]): string {
  if (errors.length === 0) return "";

  const lines = [
    "⚠️  Plugin configuration errors detected:\n",
    ...errors.map((e, i) => `  ${i + 1}. ${e.message}`),
    "",
    "Please check your agenteval.config.ts and ensure all plugins implement the required interface.",
    "See https://tlahey.github.io/agent-eval/guide/plugin-architecture for documentation.",
  ];

  return lines.join("\n");
}
