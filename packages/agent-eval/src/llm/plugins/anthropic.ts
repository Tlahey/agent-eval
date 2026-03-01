import type { AgentRunnerConfig, JudgeConfig } from "../../core/types.js";

export interface AnthropicProviderOptions {
  name?: string;
  model?: string;
  baseURL?: string;
  apiKey?: string;
}

export class AnthropicProvider implements AgentRunnerConfig, JudgeConfig {
  public readonly name: string;
  public readonly type = "api" as const;
  public readonly provider = "anthropic" as const;
  public readonly model: string;
  public readonly baseURL?: string;
  public readonly apiKey?: string;

  public readonly api: {
    provider: "anthropic";
    model: string;
    baseURL?: string;
    apiKey?: string;
  };

  constructor(options: AnthropicProviderOptions = {}) {
    this.name = options.name ?? "anthropic";
    this.model = options.model ?? "claude-3-5-sonnet-latest";
    this.baseURL = options.baseURL;
    this.apiKey = options.apiKey;

    this.api = {
      provider: this.provider,
      model: this.model,
      baseURL: this.baseURL,
      apiKey: this.apiKey,
    };
  }
}
