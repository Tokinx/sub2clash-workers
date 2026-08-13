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
import { badRequest, tooManyRequests } from "../utils/errors.js";

const MAX_API_BODY_BYTES = 1024 * 1024;
const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_SECONDS = 15 * 60;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getClientIp(c) {
  return c.req.header("cf-connecting-ip") || "unknown";
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
    const rateKey = `rate:login:${ip}`;
    const failures = Number((await c.env.CACHE.get(rateKey)) || 0);
    if (failures >= LOGIN_RATE_LIMIT_MAX) {
      throw tooManyRequests("登录尝试过于频繁，请稍后再试");
    }

    const body = await c.req.json();
    try {
      await verifyPassword(body.password, c.env);
    } catch (error) {
      // 失败计数（带 TTL 自动过期）+ 固定延时，同时防爆破与时序探测
      await c.env.CACHE.put(rateKey, String(failures + 1), {
        expirationTtl: LOGIN_RATE_LIMIT_WINDOW_SECONDS
      });
      await sleep(500);
      throw error;
    }
    await c.env.CACHE.delete(rateKey);
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
    const template = await updateTemplate(c.env, c.req.param("id"), body);
    return c.json(template);
  });

  protectedApi.delete("/templates/:id", async (c) => {
    await deleteTemplate(c.env, c.req.param("id"));
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
    const link = await updateLink(c.env, c.req.param("id"), body.config, body.remark);
    return c.json(link);
  });

  protectedApi.delete("/links/:id", async (c) => {
    await deleteLink(c.env, c.req.param("id"));
    return c.json({ ok: true });
  });

  api.route("/", protectedApi);

  return api;
}
