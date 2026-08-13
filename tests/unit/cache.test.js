import { afterEach, describe, expect, it, vi } from "vitest";

import {
  invalidateLinksBySource,
  syncLinkCacheDependencies
} from "../../src/data/cache-dependencies.js";
import { putCachedLinkOutput } from "../../src/data/link-output-cache.js";
import { createLink, deleteLink, updateLink } from "../../src/data/link-repository.js";
import { createTemplate, updateTemplate } from "../../src/data/settings-repository.js";
import {
  getCacheTtl,
  putCachedSubscription,
  refreshCachedSubscription
} from "../../src/data/subscription-cache.js";
import {
  buildLinkDependencyKey,
  buildLinkYamlCacheKey,
  buildSubscriptionCacheKey
} from "../../src/data/keys.js";
import { createEnv } from "../helpers/env.js";

describe("subscription and link caches", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("默认使用 6 小时 TTL，并让订阅与短链 YAML 共用该配置", async () => {
    const env = createEnv({ SUB_CACHE_TTL_SECONDS: undefined });

    expect(getCacheTtl(env)).toBe(21_600);
    await putCachedSubscription(env, "source-hash", { body: "body" });
    await putCachedLinkOutput(env, "link-id", { yaml: "proxies: []\n" });

    expect(env.CACHE.map.get(buildSubscriptionCacheKey("source-hash")).expirationTtl).toBe(21_600);
    expect(env.CACHE.map.get(buildLinkYamlCacheKey("link-id")).expirationTtl).toBe(21_600);
  });

  it("手动刷新失败时保留已有订阅缓存", async () => {
    const env = createEnv();
    await putCachedSubscription(env, "source-hash", { body: "old-body" });
    vi.stubGlobal("fetch", vi.fn(async () => new Response("failed", { status: 500 })));

    await expect(
      refreshCachedSubscription(env, "source-hash", "https://sub.example.com/config", { retries: 0 })
    ).rejects.toMatchObject({ status: 422 });

    expect(await env.CACHE.get(buildSubscriptionCacheKey("source-hash"), "json")).toEqual({ body: "old-body" });
  });

  it("外部源刷新会沿子短链到父短链递归清除 YAML 缓存", async () => {
    const env = createEnv();
    await syncLinkCacheDependencies(env, "child", { sources: ["source-hash"] });
    await syncLinkCacheDependencies(env, "parent", { children: ["child"] });
    await syncLinkCacheDependencies(env, "grandparent", { children: ["parent"] });
    await Promise.all(
      ["child", "parent", "grandparent"].map((id) => putCachedLinkOutput(env, id, { yaml: `${id}\n` }))
    );

    const invalidated = await invalidateLinksBySource(env, "source-hash");

    expect(invalidated).toEqual(["child", "parent", "grandparent"]);
    for (const id of invalidated) {
      expect(await env.CACHE.get(buildLinkYamlCacheKey(id))).toBeNull();
    }
  });

  it("更新或删除子短链会清除自身与父短链缓存并清理自身依赖", async () => {
    const env = createEnv();
    const child = await createLink(env, { version: 1 });
    const parent = await createLink(env, { version: 1 });
    await syncLinkCacheDependencies(env, child.id, { sources: ["source-hash"] });
    await syncLinkCacheDependencies(env, parent.id, { children: [child.id] });
    await putCachedLinkOutput(env, child.id, { yaml: "child\n" });
    await putCachedLinkOutput(env, parent.id, { yaml: "parent\n" });

    await updateLink(env, child.id, { version: 2 });
    expect(await env.CACHE.get(buildLinkYamlCacheKey(child.id))).toBeNull();
    expect(await env.CACHE.get(buildLinkYamlCacheKey(parent.id))).toBeNull();
    expect(await env.CACHE.get(buildLinkDependencyKey(child.id))).toBeNull();

    await syncLinkCacheDependencies(env, child.id, { sources: ["source-hash"] });
    await putCachedLinkOutput(env, child.id, { yaml: "child\n" });
    await deleteLink(env, child.id);
    expect(await env.CACHE.get(buildLinkYamlCacheKey(child.id))).toBeNull();
    expect(await env.CACHE.get(buildLinkDependencyKey(child.id))).toBeNull();
  });

  it("更新自建模板会清除依赖它的短链缓存", async () => {
    const env = createEnv();
    const template = await createTemplate(env, {
      name: "缓存模板",
      target: "meta",
      content: "proxies: []\nproxy-groups: []\nrules: []\n"
    });
    const link = await createLink(env, { version: 1 });
    await syncLinkCacheDependencies(env, link.id, { templates: [template.id] });
    await putCachedLinkOutput(env, link.id, { yaml: "cached\n" });

    await updateTemplate(env, template.id, {
      name: "缓存模板新版",
      target: "meta",
      content: "proxies: []\nproxy-groups: []\nrules:\n  - MATCH,DIRECT\n"
    });

    expect(await env.CACHE.get(buildLinkYamlCacheKey(link.id))).toBeNull();
  });

  it("依赖集合未变化时重复同步不再写入 KV", async () => {
    const env = createEnv();
    const link = await createLink(env, { version: 1 });
    const deps = { sources: ["source-a", "source-b"], templates: ["tpl-1"], children: [] };

    await syncLinkCacheDependencies(env, link.id, deps);

    const putSpy = vi.spyOn(env.CACHE, "put");
    const deleteSpy = vi.spyOn(env.CACHE, "delete");
    await syncLinkCacheDependencies(env, link.id, deps);
    expect(putSpy).not.toHaveBeenCalled();
    expect(deleteSpy).not.toHaveBeenCalled();

    // 反向索引依然有效，失效路径不受影响
    const invalidated = await invalidateLinksBySource(env, "source-a");
    expect(invalidated).toEqual([link.id]);
  });
});
