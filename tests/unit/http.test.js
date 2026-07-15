import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTextWithRetry } from "../../src/utils/http.js";

describe("fetchTextWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("普通抓取不传入 Workers 不支持的 default cache mode", async () => {
    const fetchMock = vi.fn(async () => new Response("subscription-body"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTextWithRetry("https://sub.example.com/config", {
      retries: 0
    });

    expect(result.text).toBe("subscription-body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]).not.toHaveProperty("cache");
  });

  it("强制刷新抓取显式使用 no-store", async () => {
    const fetchMock = vi.fn(async () => new Response("subscription-body"));
    vi.stubGlobal("fetch", fetchMock);

    await fetchTextWithRetry("https://sub.example.com/config", {
      retries: 0,
      noStore: true
    });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: "no-store"
    });
  });
});
