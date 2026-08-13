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
import { refreshExternalSubscription } from "../../src/domain/cache.js";
import { purgeSubscriptionCache } from "../../src/domain/subscription-output.js";
import { sha256Hex } from "../../src/utils/crypto.js";
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

  it("更新与删除操作返回失效的短链 id 列表，供边缘缓存 purge", async () => {
    const env = createEnv();
    const child = await createLink(env, { version: 1 });
    const parent = await createLink(env, { version: 1 });
    await syncLinkCacheDependencies(env, child.id, { sources: ["source-hash"] });
    await syncLinkCacheDependencies(env, parent.id, { children: [child.id] });
    await putCachedLinkOutput(env, child.id, { yaml: "child\n" });
    await putCachedLinkOutput(env, parent.id, { yaml: "parent\n" });

    const updated = await updateLink(env, child.id, { version: 2 });
    // 自身 + 全部父链
    expect(updated.invalidatedIds).toEqual([child.id, parent.id]);

    await syncLinkCacheDependencies(env, child.id, { sources: ["source-hash"] });
    await putCachedLinkOutput(env, child.id, { yaml: "child\n" });
    const deletedIds = await deleteLink(env, child.id);
    expect(deletedIds).toEqual([child.id, parent.id]);
  });

  it("模板更新返回依赖该模板的失效短链 id，订阅刷新返回失效 id 列表", async () => {
    const env = createEnv();
    const template = await createTemplate(env, {
      name: "Purge 模板",
      target: "meta",
      content: "proxies: []\nproxy-groups: []\nrules: []\n"
    });
    const link = await createLink(env, { version: 1 });
    await syncLinkCacheDependencies(env, link.id, { templates: [template.id] });

    const updated = await updateTemplate(env, template.id, {
      name: "Purge 模板新版",
      target: "meta",
      content: "proxies: []\nproxy-groups: []\nrules:\n  - MATCH,DIRECT\n"
    });
    expect(updated.invalidatedIds).toEqual([link.id]);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("ss://YWVzLTI1Ni1nY206cGFzc0BleGFtcGxlLmNvbTo4NDQz#PurgeNode")));
    const refreshUrl = "https://sub.example.com/purge-config";
    const sourceHash = await sha256Hex(refreshUrl);
    await syncLinkCacheDependencies(env, link.id, { sources: [sourceHash] });
    const refreshed = await refreshExternalSubscription(env, new Request("https://app.example.com/api"), {
      url: refreshUrl,
      userAgent: ""
    });
    expect(refreshed.invalidatedLinkIds).toEqual([link.id]);
    expect(refreshed.invalidatedLinkCount).toBe(1);
  });

  it("purgeSubscriptionCache 经缓存入口 RPC 按标签清除，无 exports 时静默跳过", async () => {
    const purgeByTags = vi.fn(async () => true);
    const ctx = { exports: { SubscriptionEntrypoint: { purgeByTags } } };

    await purgeSubscriptionCache(ctx, ["link-a", "link-b"]);
    expect(purgeByTags).toHaveBeenCalledWith(["link:link-a", "link:link-b"]);

    // 测试环境（无 ctx.exports）静默跳过，不报错
    await purgeSubscriptionCache(undefined, ["link-a"]);
    expect(purgeByTags).toHaveBeenCalledTimes(1);

    // 空列表不触发调用
    await purgeSubscriptionCache(ctx, []);
    expect(purgeByTags).toHaveBeenCalledTimes(1);
  });
});
