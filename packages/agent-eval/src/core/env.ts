import "dotenv/config";

/**
 * Centralized environment variable access.
 * This provides a clean API for accessing process.env variables with aliases and type safety.
 */
export const env = {
  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  },

  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY;
  },

  get googleApiKey(): string | undefined {
    return process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY;
  },

  get githubToken(): string | undefined {
    return process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  },

  get ghCopilotToken(): string | undefined {
    return process.env.GH_COPILOT_TOKEN || this.githubToken;
  },

  /**
   * Example of an alias for a specific tool like Copilot
   */
  get copilotApiKey(): string | undefined {
    return process.env.COPILOT_API_KEY || this.ghCopilotToken;
  },

  get isDebug(): boolean {
    return process.env.DEBUG === "true" || process.env.AGENTEVAL_DEBUG === "true";
  },

  get isCI(): boolean {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.CIRCLECI ||
      process.env.BUILDKITE ||
      process.env.TF_BUILD ||
      process.env.CODEBUILD_BUILD_ID
    );
  },

  /**
   * Helper to check if a specific key exists
   */
  has(key: string): boolean {
    return !!process.env[key];
  },
};
