/**
 * Global debug logger — only outputs when `--debug` flag is active.
 *
 * Usage:
 *   import { debug, setDebug } from "./debug.js";
 *   setDebug(true);  // Enable in CLI
 *   debug("some info", data);
 */

const DEBUG_KEY = Symbol.for("__agenteval_debug__");

interface DebugState {
  enabled: boolean;
}

function getState(): DebugState {
  const g = globalThis as Record<symbol, DebugState | undefined>;
  if (!g[DEBUG_KEY]) {
    g[DEBUG_KEY] = { enabled: false };
  }
  return g[DEBUG_KEY]!;
}

/** Enable or disable debug output globally. */
export function setDebug(enabled: boolean): void {
  getState().enabled = enabled;
}

/** Check whether debug mode is enabled. */
export function isDebug(): boolean {
  return getState().enabled;
}

/** Print a debug message (only when --debug is active). */
export function debug(...args: unknown[]): void {
  if (getState().enabled) {
    console.log("    🔍", ...args);
  }
}

/**
 * Mask a token for logging (e.g., "sk-abc...xyz")
 */
export function maskToken(token?: string): string {
  if (!token) return "(empty)";
  if (token.length < 8) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}
