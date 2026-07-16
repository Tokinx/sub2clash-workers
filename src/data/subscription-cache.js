import { fetchTextWithRetry } from "../utils/http.js";
import { buildSubscriptionCacheKey } from "./keys.js";

const DEFAULT_CACHE_TTL_SECONDS = 21_600;

export function getCacheTtl(env) {
  const ttl = Number(env.SUB_CACHE_TTL_SECONDS || DEFAULT_CACHE_TTL_SECONDS);
  return Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_CACHE_TTL_SECONDS;
}

export async function getCachedSubscription(env, hash) {
  return env.CACHE.get(buildSubscriptionCacheKey(hash), "json");
}

export async function putCachedSubscription(env, hash, payload) {
  await env.CACHE.put(buildSubscriptionCacheKey(hash), JSON.stringify(payload), {
    expirationTtl: getCacheTtl(env)
  });
}

export async function fetchSubscription(env, url, options = {}) {
  const result = await fetchTextWithRetry(url, {
    headers: options.userAgent ? { "User-Agent": options.userAgent } : {},
    retries: options.retries ?? 2,
    timeoutMs: options.timeoutMs ?? 10_000,
    maxBytes: options.maxBytes ?? Number(env.MAX_REMOTE_FILE_SIZE || 1_048_576),
    noStore: options.noStore
  });

  return {
    body: result.text,
    subscriptionUserinfo: result.headers.get("subscription-userinfo") || ""
  };
}

export async function refreshCachedSubscription(env, hash, url, options = {}) {
  const payload = await fetchSubscription(env, url, {
    userAgent: options.userAgent,
    retries: options.retries ?? 2,
    noStore: true
  });
  await putCachedSubscription(env, hash, payload);
  return payload;
}
