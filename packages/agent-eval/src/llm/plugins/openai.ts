import type { AgentRunnerConfig, JudgeConfig } from "../../core/types.js";

export interface OpenAIProviderOptions {
  name?: string;
  model?: string;
  baseURL?: string;
  apiKey?: string;
}

export class OpenAIProvider implements AgentRunnerConfig, JudgeConfig {
  public readonly name: string;
  public readonly type = "api" as const;
  public readonly provider = "openai" as const;
  public readonly model: string;
  public readonly baseURL?: string;
  public readonly apiKey?: string;

  public readonly api: {
    provider: "openai";
    model: string;
    baseURL?: string;
    apiKey?: string;
  };

  constructor(options: OpenAIProviderOptions = {}) {
    this.name = options.name ?? "openai";
    this.model = options.model ?? "gpt-4o";
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
