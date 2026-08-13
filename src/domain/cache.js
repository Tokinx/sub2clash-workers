import { invalidateLinksBySource } from "../data/cache-dependencies.js";
import { refreshCachedSubscription } from "../data/subscription-cache.js";
import { sha256Hex } from "../utils/crypto.js";
import { badRequest } from "../utils/errors.js";

export async function refreshExternalSubscription(env, request, input = {}) {
  const rawUrl = typeof input.url === "string" ? input.url.trim() : "";
  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    throw badRequest("订阅地址格式错误");
  }

  if (!["http:", "https:"].includes(target.protocol)) {
    throw badRequest("订阅地址仅支持 http/https");
  }

  const current = new URL(request.url);
  if (target.origin === current.origin) {
    throw badRequest("同域订阅不支持手动刷新缓存");
  }

  const url = target.toString();
  const hash = await sha256Hex(url);
  await refreshCachedSubscription(env, hash, url, {
    userAgent: typeof input.userAgent === "string" ? input.userAgent : ""
  });
  const invalidatedLinkIds = await invalidateLinksBySource(env, hash);

  return {
    ok: true,
    invalidatedLinkCount: invalidatedLinkIds.length,
    invalidatedLinkIds
  };
}
