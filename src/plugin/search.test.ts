import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeSearch } from "./search";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeResponse(
  text: string,
  opts: {
    searchQueries?: string[];
    chunks?: Array<{ title: string; uri: string }>;
    urlMetadata?: Array<{ retrieved_url: string; url_retrieval_status: string }>;
  } = {},
) {
  return {
    response: {
      candidates: [
        {
          content: { role: "model", parts: [{ text }] },
          finishReason: "STOP",
          groundingMetadata: {
            webSearchQueries: opts.searchQueries ?? [],
            groundingChunks: (opts.chunks ?? []).map((c) => ({ web: c })),
          },
          urlContextMetadata: { url_metadata: opts.urlMetadata ?? [] },
        },
      ],
    },
  };
}

function mockFetch(body: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ─── executeSearch ────────────────────────────────────────────────────────────

describe("executeSearch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch(makeResponse("Default result")));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns formatted text from the response", async () => {
    vi.stubGlobal("fetch", mockFetch(makeResponse("The answer is 42.")));
    const result = await executeSearch({ query: "what is 42?" }, "tok", "proj");
    expect(result).toContain("The answer is 42.");
    expect(result).toContain("## Search Results");
  });

  it("lists sources from groundingChunks (uses groundingMeta internally)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("answer", {
          chunks: [{ title: "Example", uri: "https://example.com/page" }],
        }),
      ),
    );
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("### Sources");
    expect(result).toContain("Example");
    expect(result).toContain("https://example.com/page");
  });

  it("includes search queries section when queries are present", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(makeResponse("res", { searchQueries: ["my query"] })),
    );
    const result = await executeSearch({ query: "my query" }, "tok", "proj");
    expect(result).toContain("### Search Queries Used");
    expect(result).toContain('"my query"');
  });

  it("marks successful URL retrieval with ✓", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("ok", {
          urlMetadata: [
            { retrieved_url: "https://docs.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_SUCCESS" },
          ],
        }),
      ),
    );
    const result = await executeSearch({ query: "q", urls: ["https://docs.example.com"] }, "tok", "proj");
    expect(result).toContain("✓");
    expect(result).toContain("https://docs.example.com");
  });

  it("marks failed URL retrieval with ✗", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch(
        makeResponse("ok", {
          urlMetadata: [
            { retrieved_url: "https://broken.example.com", url_retrieval_status: "URL_RETRIEVAL_STATUS_ERROR" },
          ],
        }),
      ),
    );
    const result = await executeSearch({ query: "q", urls: ["https://broken.example.com"] }, "tok", "proj");
    expect(result).toContain("✗");
  });

  it("returns error block on non-OK HTTP response", async () => {
    vi.stubGlobal("fetch", mockFetch({ error: "bad" }, 400));
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("400");
  });

  it("returns error block when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network down")));
    const result = await executeSearch({ query: "q" }, "tok", "proj");
    expect(result).toContain("## Search Error");
    expect(result).toContain("Network down");
  });

  it("includes Authorization header with the provided token", async () => {
    const spy = mockFetch(makeResponse("ok"));
    vi.stubGlobal("fetch", spy);
    await executeSearch({ query: "q" }, "bearer-token-xyz", "proj");
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer bearer-token-xyz",
    );
  });

  it("falls back to the next model when the first is unavailable", async () => {
    const spy = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      if (body.model === "model-a") {
        return Promise.resolve({
          ok: false,
          status: 503,
          statusText: "Service Unavailable",
          text: () => Promise.resolve("no capacity"),
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(""),
        json: () => Promise.resolve(makeResponse("second model answer")),
      });
    });
    vi.stubGlobal("fetch", spy);

    const result = await executeSearch({ query: "q" }, "tok", "proj", undefined, [
      "model-a",
      "model-b",
    ]);

    expect(result).toContain("second model answer");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("treats a 'no longer available' 200 body as a failure and advances", async () => {
    let call = 0;
    const spy = vi.fn().mockImplementation(() => {
      call += 1;
      const body =
        call === 1
          ? makeResponse(
              "Gemini 3.5 Flash is no longer available. Please switch to Gemini 3.7 Flash.",
            )
          : makeResponse("fresh answer");
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve(""),
        json: () => Promise.resolve(body),
      });
    });
    vi.stubGlobal("fetch", spy);

    const result = await executeSearch({ query: "q" }, "tok", "proj", undefined, [
      "old-flash",
      "new-flash",
    ]);

    expect(result).toContain("fresh answer");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("returns the last error when every model in the chain fails", async () => {
    const spy = vi.fn();
    spy.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: () => Promise.resolve("bad"),
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", spy);

    const result = await executeSearch({ query: "q" }, "tok", "proj", undefined, [
      "a",
      "b",
    ]);

    expect(result).toContain("## Search Error");
    expect(result).toContain("400");
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
