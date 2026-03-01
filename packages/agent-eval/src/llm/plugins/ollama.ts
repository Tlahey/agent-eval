import type { AgentRunnerConfig, JudgeConfig } from "../../core/types.js";

export interface OllamaProviderOptions {
  name?: string;
  model?: string;
  baseURL?: string;
}

export class OllamaProvider implements AgentRunnerConfig, JudgeConfig {
  public readonly name: string;
  public readonly type = "api" as const;
  public readonly provider = "ollama" as const;
  public readonly model: string;
  public readonly baseURL?: string;

  public readonly api: {
    provider: "ollama";
    model: string;
    baseURL?: string;
  };

  constructor(options: OllamaProviderOptions = {}) {
    this.name = options.name ?? "ollama";
    this.model = options.model ?? "llama3";
    this.baseURL = options.baseURL;

    this.api = {
      provider: this.provider,
      model: this.model,
      baseURL: this.baseURL,
    };
  }
}
