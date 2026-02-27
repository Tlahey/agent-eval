# TestContext

The context object injected into every test function. Acts as a black box to store diffs, command outputs, and logs.

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

Captures the current git diff (staged + unstaged) into the context.

### `runCommand(name, command)`

Runs a shell command and stores the result.

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

## Properties

| Property   | Type              | Description                                |
| ---------- | ----------------- | ------------------------------------------ |
| `diff`     | `string \| null`  | Captured git diff                          |
| `commands` | `CommandResult[]` | All command results                        |
| `logs`     | `string`          | Formatted log string (diff + all commands) |
