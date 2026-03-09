# ADR 010: Isolated Parallel Execution

## Status

Accepted (2025-03-09)

## Context

In [ADR 003](./003-sequential-execution.md), we decided to run tests sequentially because agents mutate the filesystem and Git state. While safe, this became a major bottleneck as the number of variants (A/B testing) and runners increased. Running 5 models on a 2-minute test would take 10 minutes sequentially.

## Decision

We decided to enable **Parallel Execution** by shifting from _temporal isolation_ (cleaning the same directory between runs) to _spatial isolation_ (providing a unique environment for each variant).

### 1. Enhanced Environment Interface

The `IEnvironmentPlugin` was extended to support concurrency:

- `supportsConcurrency`: A flag indicating if the environment can isolate multiple parallel agents.
- `prepareRun(cwd, runId)`: Creates a dedicated workspace (e.g., a Docker container or a temporary directory clone).
- `teardownRun(cwd, workingDir)`: Cleans up the dedicated workspace after evaluation.

### 2. New Isolated Environments

- **DockerEnvironment**: Spawns a unique container per variant (`docker run`). Commands are executed via `docker exec`.
- **SandboxExecEnvironment (macOS)**: Uses `sandbox-exec` (Seatbelt) for security, combined with temporary directory cloning to allow parallel filesystem access on the host.

### 3. Parallel-Aware Runner

The `Runner` now checks `environment.supportsConcurrency`:

- If `true`: It executes all variants of a test simultaneously using `Promise.all()`.
- If `false`: It falls back to the legacy sequential loop (essential for `LocalEnvironment` which shares the `.git` state).

## Consequences

- **Drastic Speedup**: A/B testing multiple models now takes as long as the slowest model, regardless of the number of variants (provided enough system resources).
- **Absolute Isolation**: Variants can no longer interfere with each other since they operate in physically separate directories or containers.
- **Resource Management**: Running many agents in parallel (especially via Docker) requires more CPU/RAM. Users can still opt for the `LocalEnvironment` to stay sequential.
- **Complexity**: Environment plugins are now responsible for managing lifecycle states (container IDs, temporary paths).
