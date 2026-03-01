import type { IEnvironmentPlugin } from "./interfaces.js";
import { extractChangedFiles } from "../judge/judge.js";
import type {
  CommandResult,
  ExecutionData,
  TaskDefinition,
  TaskResult,
  TestContext,
  TimingData,
  TokenUsage,
} from "./types.js";

export class EvalContext implements TestContext {
  private _diff: string | null = null;
  private _commands: CommandResult[] = [];
  private _tasks: TaskDefinition[] = [];
  private _cwd: string;
  private _env: IEnvironmentPlugin;
  private _agentOutput: string | undefined;
  private _agentTokenUsage: TokenUsage | undefined;
  private _instruction: string = "";
  private _runnerInfo: { name: string; model: string } = { name: "unknown", model: "unknown" };

  constructor(cwd: string, env: IEnvironmentPlugin) {
    this._cwd = cwd;
    this._env = env;
  }

  /** Store the raw agent output (stdout for CLI, response for API) */
  setAgentOutput(output: string): void {
    this._agentOutput = output;
  }

  /** Store the agent's token usage (API runners) */
  setAgentTokenUsage(usage: TokenUsage): void {
    this._agentTokenUsage = usage;
  }

  /** Store the instruction given to the agent */
  setInstruction(instruction: string): void {
    this._instruction = instruction;
  }

  /** Store runner metadata */
  setRunnerInfo(info: { name: string; model: string }): void {
    this._runnerInfo = info;
  }

  get agentOutput(): string | undefined {
    return this._agentOutput;
  }

  get agentTokenUsage(): TokenUsage | undefined {
    return this._agentTokenUsage;
  }

  get instruction(): string {
    return this._instruction;
  }

  get runnerInfo(): { name: string; model: string } {
    return this._runnerInfo;
  }

  storeDiff(): void {
    const result = this._env.getDiff(this._cwd);
    // Handle both sync and async getDiff
    if (result instanceof Promise) {
      throw new Error(
        "storeDiff() is synchronous — use an environment plugin with a sync getDiff()",
      );
    }
    this._diff = result as string;
  }

  /** Async version of storeDiff for environments returning promises */
  async storeDiffAsync(): Promise<void> {
    this._diff = await this._env.getDiff(this._cwd);
  }

  async runCommand(name: string, command: string): Promise<CommandResult> {
    const start = Date.now();
    const result = await this._env.execute(command, this._cwd, { timeout: 120_000 });

    const cmd: CommandResult = {
      name,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs: Date.now() - start,
    };

    this._commands.push(cmd);
    return cmd;
  }

  addTask(task: TaskDefinition): void {
    if (!task.name || typeof task.name !== "string") {
      throw new Error("Task must have a non-empty name");
    }
    if (typeof task.action !== "function") {
      throw new Error(`Task "${task.name}" must have an action function`);
    }
    if (!task.criteria || typeof task.criteria !== "string") {
      throw new Error(`Task "${task.name}" must have non-empty criteria`);
    }
    if (task.weight !== undefined && (typeof task.weight !== "number" || task.weight < 0)) {
      throw new Error(`Task "${task.name}" weight must be a non-negative number`);
    }
    this._tasks.push(task);
  }

  async exec(command: string): Promise<CommandResult> {
    const shortName = command.split(/\s+/)[0];
    return this.runCommand(shortName, command);
  }

  get diff(): string | null {
    return this._diff;
  }

  get commands(): CommandResult[] {
    return [...this._commands];
  }

  get tasks(): ReadonlyArray<TaskDefinition> {
    return [...this._tasks];
  }

  get logs(): string {
    const parts: string[] = [];

    if (this._diff) {
      parts.push(`── Git Diff ──\n${this._diff}`);
    }

    for (const cmd of this._commands) {
      parts.push(
        `── ${cmd.name} (exit ${cmd.exitCode}, ${cmd.durationMs}ms) ──\n$ ${cmd.command}\n${cmd.stdout}${cmd.stderr ? `\nSTDERR:\n${cmd.stderr}` : ""}`,
      );
    }

    return parts.join("\n\n");
  }

  /**
   * Build the unified ExecutionData from all collected context.
   * Called by the runner to pass to the judge and store in the ledger.
   */
  buildExecutionData(
    taskResults: TaskResult[],
    timing: TimingData,
  ): ExecutionData {
    return {
      instruction: this._instruction,
      runner: { ...this._runnerInfo },
      diff: this._diff,
      changedFiles: extractChangedFiles(this._diff),
      commands: [...this._commands],
      taskResults,
      tokenUsage: this._agentTokenUsage,
      timing,
      agentOutput: this._agentOutput,
      logs: this.logs,
    };
  }
}
