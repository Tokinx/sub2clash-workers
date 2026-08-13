import {
  buildChildLinkDependentsKey,
  buildLinkDependencyKey,
  buildSourceDependentsKey,
  buildTemplateDependentsKey
} from "./keys.js";
import { deleteCachedLinkOutput } from "./link-output-cache.js";
import { stableStringify } from "../utils/object.js";

function normalizeList(value) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string" && item) : [])].sort();
}

function normalizeDependencies(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    sources: normalizeList(source.sources),
    templates: normalizeList(source.templates),
    children: normalizeList(source.children)
  };
}

async function readStringList(env, key) {
  return normalizeList(await env.CACHE.get(key, "json"));
}

async function updateStringList(env, key, update) {
  const current = await readStringList(env, key);
  const next = normalizeList(update(current));
  if (next.length) {
    await env.CACHE.put(key, JSON.stringify(next));
  } else {
    await env.CACHE.delete(key);
  }
}

function dependencyEntries(dependencies) {
  return [
    ...dependencies.sources.map((value) => [buildSourceDependentsKey(value), value]),
    ...dependencies.templates.map((value) => [buildTemplateDependentsKey(value), value]),
    ...dependencies.children.map((value) => [buildChildLinkDependentsKey(value), value])
  ];
}

export async function removeLinkCacheDependencies(env, id) {
  const key = buildLinkDependencyKey(id);
  const current = normalizeDependencies(await env.CACHE.get(key, "json"));
  await Promise.all(
    dependencyEntries(current).map(([reverseKey]) =>
      updateStringList(env, reverseKey, (items) => items.filter((item) => item !== id))
    )
  );
  await env.CACHE.delete(key);
}

export async function syncLinkCacheDependencies(env, id, dependencies) {
  const next = normalizeDependencies(dependencies);
  const key = buildLinkDependencyKey(id);

  // 依赖集合未变化时跳过全部写入：每次输出缓存过期后的冷渲染都会走到这里，
  // 多数情况下依赖并无变化，而 KV 写是计费单价最高的操作
  const current = normalizeDependencies(await env.CACHE.get(key, "json"));
  if (stableStringify(current) === stableStringify(next)) {
    return;
  }

  await removeLinkCacheDependencies(env, id);
  await Promise.all(
    dependencyEntries(next).map(([reverseKey]) =>
      updateStringList(env, reverseKey, (items) => [...items, id])
    )
  );
  await env.CACHE.put(key, JSON.stringify(next));
}

export async function invalidateLinkCaches(env, initialIds) {
  const queue = normalizeList(initialIds);
  const visited = new Set();

  while (queue.length) {
    const id = queue.shift();
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);
    await deleteCachedLinkOutput(env, id);
    const parents = await readStringList(env, buildChildLinkDependentsKey(id));
    queue.push(...parents.filter((parentId) => !visited.has(parentId)));
  }

  return [...visited];
}

export async function invalidateLinksBySource(env, hash) {
  return invalidateLinkCaches(env, await readStringList(env, buildSourceDependentsKey(hash)));
}

export async function invalidateLinksByTemplate(env, id) {
  return invalidateLinkCaches(env, await readStringList(env, buildTemplateDependentsKey(id)));
}
