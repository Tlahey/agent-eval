# TestContext

The context object injected into every test function. Acts as a black box to store diffs, command outputs, and logs.

## Lifecycle

```mermaid
flowchart LR
    A["agent.run()"] --> B["storeDiff()\n(automatic)"]
    B --> C["afterEach commands\n(automatic)"]
    C --> D["ctx ready for\njudge evaluation"]

    style B fill:#6366f1,color:#fff
    style D fill:#10b981,color:#fff
```

::: tip Auto-capture
`storeDiff()` is called **automatically** after `agent.run()`. You only need to call it manually if you want to capture a diff at a specific point outside the normal flow.

`afterEach` commands defined in your config are also executed automatically — they appear in `ctx.commands` when the judge evaluates.
:::

## Interface

```ts
interface TestContext {
  storeDiff(): void;
  runCommand(name: string, command: string): Promise<CommandResult>;
  readonly diff: string | null;
  readonly commands: CommandResult[];
  readonly logs: string;
}
```

## Methods

### `storeDiff()`

Captures the current git diff (staged + unstaged) into the context. **Called automatically** after `agent.run()`.

### `runCommand(name, command)`

Runs a shell command and stores the result. Each command has a **120-second timeout**.

```ts
interface CommandResult {
  name: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}
```

::: info
For commands that should run after every agent execution, use the `afterEach` config option instead of calling `runCommand()` in every test file.
:::

## Properties

| Property   | Type              | Description                                |
| ---------- | ----------------- | ------------------------------------------ |
| `diff`     | `string \| null`  | Captured git diff (auto-populated)         |
| `commands` | `CommandResult[]` | All command results (manual + afterEach)   |
| `logs`     | `string`          | Formatted log string (diff + all commands) |

The `logs` property combines the diff and all command outputs into a single formatted string, which is used internally by the judge prompt builder.
