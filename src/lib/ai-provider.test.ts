import { afterEach, describe, expect, it, vi } from "vitest";
import { getAiProviderConfig } from "@/lib/ai-provider";

describe("AI provider configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses RunningHub defaults when the RunningHub provider is selected", () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_PROVIDER", "runninghub");
    vi.stubEnv("RUNNINGHUB_API_KEY", "server-only-key");

    expect(getAiProviderConfig()).toMatchObject({
      provider: "runninghub",
      baseUrl: "https://llm.runninghub.cn/v1",
      apiKey: "server-only-key",
      model: "bytedance/doubao-seed-evolving",
      appCode: "vibex",
    });
  });

  it("keeps the existing OpenAI-compatible configuration available", () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_PROVIDER", "compatible");
    vi.stubEnv("AI_BASE_URL", "https://example.com/v1/");
    vi.stubEnv("AI_API_KEY", "server-only-key");
    vi.stubEnv("AI_MODEL", "example-model");

    expect(getAiProviderConfig()).toMatchObject({
      provider: "compatible",
      baseUrl: "https://example.com/v1",
      model: "example-model",
    });
  });

  it("keeps local fallback when the selected provider is incomplete", () => {
    vi.stubEnv("AI_ENABLED", "true");
    vi.stubEnv("AI_PROVIDER", "runninghub");

    expect(getAiProviderConfig()).toBeNull();
  });
});
