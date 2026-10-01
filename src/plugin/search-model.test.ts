import { afterEach, describe, expect, it, vi } from "vitest";
import type { SearchConfig } from "./config/schema";
import {
  clearSearchModelCache,
  discoverSearchModels,
  rankSearchCandidates,
  resolveSearchModelChain,
} from "./search-model";

const baseConfig: SearchConfig = {
  enabled: true,
  model: null,
  auto_discover: true,
  preferred_tier: "high",
  fallback_models: ["gemini-2.5-flash", "gemini-3-flash"],
  discover_cache_seconds: 300,
};

function availableModelsResponse(ids: string[]) {
  return {
    models: Object.fromEntries(
      ids.map((id) => [id, { displayName: id, quotaInfo: { remainingFraction: 1 } }]),
    ),
  };
}

function mockModelsFetch(ids: string[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve(availableModelsResponse(ids)),
    text: () => Promise.resolve(""),
  });
}

describe("rankSearchCandidates", () => {
  it("keeps flash grounding ids and drops non-grounding variants", () => {
    const ranked = rankSearchCandidates([
      "gemini-3.1-flash-image",
      "gemini-3.5-flash-lite",
      "gemini-3-flash-agent",
      "gemini-3.6-flash-tiered",
      "tab_flash_lite_preview",
      "gemini-3.6-flash-low",
      "gemini-3.6-flash-high",
      "gemini-2.5-flash",
    ]);

    expect(ranked).toEqual([
      "gemini-3.6-flash-high",
      "gemini-3.6-flash-low",
      "gemini-2.5-flash",
    ]);
  });

  it("prefers the requested tier within a version", () => {
    const ranked = rankSearchCandidates(
      ["gemini-3.6-flash-low", "gemini-3.6-flash-medium", "gemini-3.6-flash-high"],
      "medium",
    );

    expect(ranked[0]).toBe("gemini-3.6-flash-medium");
  });

  it("sorts newer major/minor versions first", () => {
    const ranked = rankSearchCandidates([
      "gemini-3-flash",
      "gemini-3.6-flash-high",
      "gemini-3.1-flash-high",
    ]);

    expect(ranked).toEqual([
      "gemini-3.6-flash-high",
      "gemini-3.1-flash-high",
      "gemini-3-flash",
    ]);
  });
});

describe("resolveSearchModelChain", () => {
  afterEach(() => {
    clearSearchModelCache();
    vi.restoreAllMocks();
  });

  it("orders explicit -> discovered -> static fallback, de-duplicated", async () => {
    vi.stubGlobal(
      "fetch",
      mockModelsFetch([
        "gemini-3.6-flash-high",
        "gemini-2.5-flash",
        "gemini-3.1-flash-image",
      ]),
    );

    const chain = await resolveSearchModelChain(
      { ...baseConfig, model: "gemini-3-flash" },
      "tok",
      "proj",
    );

    expect(chain).toEqual([
      "gemini-3-flash",
      "gemini-3.6-flash-high",
      "gemini-2.5-flash",
    ]);
  });

  it("falls back to the static chain when discovery fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const chain = await resolveSearchModelChain(baseConfig, "tok", "proj");

    expect(chain).toEqual(["gemini-2.5-flash", "gemini-3-flash"]);
  });

  it("uses only the explicit model when disabled", async () => {
    const spy = mockModelsFetch(["gemini-3.6-flash-high"]);
    vi.stubGlobal("fetch", spy);

    const chain = await resolveSearchModelChain(
      { ...baseConfig, enabled: false, model: "gemini-3-flash" },
      "tok",
      "proj",
    );

    expect(chain).toEqual(["gemini-3-flash"]);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("discoverSearchModels", () => {
  afterEach(() => {
    clearSearchModelCache();
    vi.restoreAllMocks();
  });

  it("caches the discovered list per project", async () => {
    const spy = mockModelsFetch(["gemini-3-flash"]);
    vi.stubGlobal("fetch", spy);

    await discoverSearchModels("tok", "proj", 300);
    await discoverSearchModels("tok", "proj", 300);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("returns an empty list when discovery fails with no cache", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await expect(discoverSearchModels("tok", "proj", 300)).resolves.toEqual([]);
  });
});
