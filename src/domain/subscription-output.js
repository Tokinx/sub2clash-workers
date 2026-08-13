import { syncLinkCacheDependencies } from "../data/cache-dependencies.js";
import { putCachedLinkOutput } from "../data/link-output-cache.js";
import { badRequest } from "../utils/errors.js";
import { decodeBase64UrlText } from "../utils/base64url.js";
import { renderConfig, renderLink } from "./render.js";

// /sub/:payload 的 payload 即配置指纹：URL 变化即新缓存条目，边缘缓存可放心用长 TTL
const LONG_PAYLOAD_EDGE_TTL_SECONDS = 21_600;
// /s/:id 的链接配置可被修改：purge 精确失效就位前保持短 TTL 兜底
const SHORT_LINK_EDGE_TTL_SECONDS = 300;
// base64url 解码前限制原始 payload 长度，防未认证 CPU DoS
const MAX_SUB_PAYLOAD_BYTES = 32 * 1024;

// KV 缓存回写放到后台执行：真实运行时用 ExecutionContext.waitUntil（不阻塞响应），
// 无 ExecutionContext 的环境（如测试）直接等待，保证行为可断言
function writeCacheInBackground(ctx, tasks) {
  const work = Promise.allSettled(tasks);
  if (ctx?.waitUntil) {
    ctx.waitUntil(work);
    return;
  }
  return work;
}

// 管理台变更后按 link 标签 purge Workers Caching 条目：
// purge 按 entrypoint 作用域隔离，须经 SubscriptionEntrypoint 的 RPC 调用；
// 无 exports 环境（测试）时静默跳过
export async function purgeSubscriptionCache(ctx, linkIds) {
  const ids = Array.isArray(linkIds) ? linkIds.filter(Boolean) : [];
  if (ids.length === 0) {
    return;
  }
  const entrypoint = ctx?.exports?.SubscriptionEntrypoint;
  if (entrypoint?.purgeByTags) {
    await entrypoint.purgeByTags(ids.map((id) => `link:${id}`));
  }
}

// 订阅输出统一入口：由 Workers Caching 缓存入口（SubscriptionEntrypoint）与
// 无 exports 环境（测试）的兜底路径共用。命中 Workers Caching 时整个入口不执行。
export async function handleSubscriptionRequest(env, ctx, request) {
  const pathname = new URL(request.url).pathname;

  let result;
  let cacheable;
  let linkId = null;

  if (pathname.startsWith("/s/")) {
    linkId = pathname.slice(3);
    result = await renderLink(env, request, linkId);
    cacheable = result.cacheable !== false;
  } else if (pathname.startsWith("/sub/")) {
    const payload = pathname.slice(5);
    if (payload.length > MAX_SUB_PAYLOAD_BYTES) {
      throw badRequest("订阅参数过长");
    }
    let config;
    try {
      config = JSON.parse(decodeBase64UrlText(payload));
    } catch {
      throw badRequest("订阅参数无效");
    }
    result = await renderConfig(env, request, config);
    cacheable = config?.options?.refresh !== true;
  } else {
    return new Response("Not Found", { status: 404 });
  }

  const headers = new Headers();
  headers.set("content-type", "text/yaml; charset=utf-8");
  if (result.subscriptionUserinfo) {
    headers.set("subscription-userinfo", result.subscriptionUserinfo);
  }

  if (!cacheable) {
    headers.set("Cache-Control", "no-store");
    return new Response(result.yaml, { status: 200, headers });
  }

  headers.set(
    "Cache-Control",
    `public, s-maxage=${linkId === null ? LONG_PAYLOAD_EDGE_TTL_SECONDS : SHORT_LINK_EDGE_TTL_SECONDS}`
  );

  if (linkId !== null) {
    // Cache-Tag 供管理台变更时按标签 purge 精确失效（Workers Caching）
    headers.set("Cache-Tag", `link:${linkId}`);
    // 缓存命中的响应不含 dependencies（渲染时才有），无需回写；
    // 新渲染结果在后台并行写 KV，失败不影响响应
    if (result.dependencies) {
      const { yaml, subscriptionUserinfo, stats, warnings } = result;
      await writeCacheInBackground(ctx, [
        syncLinkCacheDependencies(env, linkId, result.dependencies),
        putCachedLinkOutput(env, linkId, { yaml, subscriptionUserinfo, stats, warnings })
      ]);
    }
  }

  return new Response(result.yaml, { status: 200, headers });
}
