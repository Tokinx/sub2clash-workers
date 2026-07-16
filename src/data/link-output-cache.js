import { getCacheTtl } from "./subscription-cache.js";
import { buildLinkYamlCacheKey } from "./keys.js";

export async function getCachedLinkOutput(env, id) {
  return env.CACHE.get(buildLinkYamlCacheKey(id), "json");
}

export async function putCachedLinkOutput(env, id, payload) {
  await env.CACHE.put(buildLinkYamlCacheKey(id), JSON.stringify(payload), {
    expirationTtl: getCacheTtl(env)
  });
}

export async function deleteCachedLinkOutput(env, id) {
  await env.CACHE.delete(buildLinkYamlCacheKey(id));
}
