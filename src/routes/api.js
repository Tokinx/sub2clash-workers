import { Hono } from "hono";

import { requireSession } from "../auth/middleware.js";
import { verifyPassword } from "../auth/password.js";
import { clearSessionCookie, createSessionCookie, getSessionFromRequest } from "../auth/session.js";
import { createLink, deleteLink, getLink, listLinks, updateLink } from "../data/link-repository.js";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listCustomTemplates,
  updateTemplate
} from "../data/settings-repository.js";
import { listBuiltinTemplates } from "../domain/builtin-templates.js";
import { refreshExternalSubscription } from "../domain/cache.js";
import { renderConfig } from "../domain/render.js";
import { purgeSubscriptionCache } from "../domain/subscription-output.js";
import { badRequest, tooManyRequests } from "../utils/errors.js";
import { sha256Hex } from "../utils/crypto.js";

const MAX_API_BODY_BYTES = 1024 * 1024;
const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClientIp(c) {
  return c.req.header("cf-connecting-ip") || "unknown";
}

// Hono 测试环境无 ExecutionContext（c.executionCtx getter 会抛错），
// 从 env.context 读取真实运行时的 ExecutionContext
function getExecutionContext(c) {
  return c.env?.context ?? c.env?.ctx;
}

// 登录限速计数存放在独立 Cache API 命名空间而非 KV：
// 读写不消耗 KV 配额（免费层 KV 写仅 1 千次/天，暴力攻击反而会先刷爆），
// 仅在登录失败时才产生 match/put。独立命名空间避免与 fetch() 子请求
// 共享的 caches.default 相互驱逐。Cache API 是区域性、尽力而为的缓存，
// 条目可能被回收或跨区域独立，限速因此是防御性降级而非绝对保证。
const LOGIN_RATE_LIMIT_CACHE_HOST = "https://rate.internal";
const LOGIN_RATE_LIMIT_CACHE_NAME = "sub2clash:ratelimit";

let rateLimitCachePromise;
function getRateLimitCache() {
  rateLimitCachePromise ??= caches.open(LOGIN_RATE_LIMIT_CACHE_NAME);
  return rateLimitCachePromise;
}

async function buildLoginRateKey(ip) {
  const hash = await sha256Hex(ip);
  return `${LOGIN_RATE_LIMIT_CACHE_HOST}/login/${hash}`;
}

async function readLoginFailures(ip) {
  const cached = await (await getRateLimitCache()).match(await buildLoginRateKey(ip));
  if (!cached) {
    return 0;
  }
  return Number(await cached.text()) || 0;
}

async function recordLoginFailure(ip, count) {
  await (await getRateLimitCache()).put(
    await buildLoginRateKey(ip),
    new Response(String(count), {
      headers: { "Cache-Control": `public, s-maxage=${LOGIN_RATE_LIMIT_WINDOW_SECONDS}` }
    })
  );
}

async function clearLoginFailures(ip) {
  await (await getRateLimitCache()).delete(await buildLoginRateKey(ip));
}

export function createApiRouter() {
  const api = new Hono();
  const protectedApi = new Hono();

  // API 响应一律 no-store，避免浏览器启发式缓存会话状态；
  // 认证接口统一限制请求体大小
  api.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    const contentLength = Number(c.req.header("content-length") || 0);
    if (contentLength > MAX_API_BODY_BYTES) {
      throw badRequest("请求体过大");
    }
    await next();
  });

  protectedApi.use("/*", requireSession);

  api.post("/auth/login", async (c) => {
    const ip = getClientIp(c);
    const failures = await readLoginFailures(ip);
    if (failures >= LOGIN_RATE_LIMIT_MAX) {
      throw tooManyRequests("登录尝试过于频繁，请稍后再试");
    }

    const body = await c.req.json();
    try {
      await verifyPassword(body.password, c.env);
    } catch (error) {
      // 失败计数写入 Cache API（s-maxage 控制过期）+ 固定延时，同时防爆破与时序探测
      await recordLoginFailure(ip, failures + 1);
      await sleep(500);
      throw error;
    }
    await clearLoginFailures(ip);
    c.header("Set-Cookie", await createSessionCookie(c.env, c.req.raw));
    return c.json({ ok: true });
  });

  api.post("/auth/logout", async (c) => {
    c.header("Set-Cookie", clearSessionCookie(c.req.raw));
    return c.json({ ok: true });
  });

  api.get("/auth/session", async (c) => {
    const session = await getSessionFromRequest(c.req.raw, c.env);
    return c.json({ authenticated: Boolean(session) });
  });

  protectedApi.post("/render", async (c) => {
    const body = await c.req.json();
    const result = await renderConfig(c.env, c.req.raw, body);
    return c.json(result);
  });

  protectedApi.post("/subscriptions/refresh", async (c) => {
    const body = await c.req.json();
    const result = await refreshExternalSubscription(c.env, c.req.raw, body);
    // 同步清除受影响短链的 Workers Caching 边缘缓存条目
    await purgeSubscriptionCache(getExecutionContext(c), result.invalidatedLinkIds);
    return c.json(result);
  });

  protectedApi.get("/templates", async (c) => {
    const builtin = listBuiltinTemplates();
    const custom = await listCustomTemplates(c.env);
    return c.json({
      builtin,
      custom
    });
  });

  protectedApi.post("/templates", async (c) => {
    const body = await c.req.json();
    if (body.action === "duplicate" && body.id) {
      const template = await duplicateTemplate(c.env, body.id);
      return c.json(template, 201);
    }
    const template = await createTemplate(c.env, body);
    return c.json(template, 201);
  });

  protectedApi.put("/templates/:id", async (c) => {
    const body = await c.req.json();
    const result = await updateTemplate(c.env, c.req.param("id"), body);
    await purgeSubscriptionCache(getExecutionContext(c), result.invalidatedIds);
    return c.json(result.template);
  });

  protectedApi.delete("/templates/:id", async (c) => {
    const invalidatedIds = await deleteTemplate(c.env, c.req.param("id"));
    await purgeSubscriptionCache(getExecutionContext(c), invalidatedIds);
    return c.json({ ok: true });
  });

  protectedApi.post("/links", async (c) => {
    const body = await c.req.json();
    const link = await createLink(c.env, body.config, body.remark);
    return c.json(link, 201);
  });

  protectedApi.get("/links", async (c) => {
    const links = await listLinks(c.env);
    return c.json({ links });
  });

  protectedApi.get("/links/:id", async (c) => {
    const link = await getLink(c.env, c.req.param("id"));
    return c.json(link);
  });

  protectedApi.put("/links/:id", async (c) => {
    const body = await c.req.json();
    const result = await updateLink(c.env, c.req.param("id"), body.config, body.remark);
    await purgeSubscriptionCache(getExecutionContext(c), result.invalidatedIds);
    return c.json(result.record);
  });

  protectedApi.delete("/links/:id", async (c) => {
    const invalidatedIds = await deleteLink(c.env, c.req.param("id"));
    await purgeSubscriptionCache(getExecutionContext(c), invalidatedIds);
    return c.json({ ok: true });
  });

  api.route("/", protectedApi);

  return api;
}
