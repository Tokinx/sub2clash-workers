import { Hono } from "hono";

import { requireSession } from "../auth/middleware.js";
import { verifyPassword } from "../auth/password.js";
import { clearSessionCookie, createSessionCookie, getSessionFromRequest } from "../auth/session.js";
import { createLink, deleteLink, getLink, updateLink } from "../data/link-repository.js";
import {
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  listCustomTemplates,
  updateTemplate
} from "../data/settings-repository.js";
import { listBuiltinTemplates } from "../domain/builtin-templates.js";
import { renderConfig } from "../domain/render.js";

export function createApiRouter() {
  const api = new Hono();
  const protectedApi = new Hono();

  protectedApi.use("/*", requireSession);

  api.post("/auth/login", async (c) => {
    const body = await c.req.json();
    await verifyPassword(body.password, c.env);
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
    const link = await createLink(c.env, body.config);
    return c.json(link, 201);
  });

  protectedApi.get("/links/:id", async (c) => {
    const link = await getLink(c.env, c.req.param("id"));
    return c.json(link);
  });

  protectedApi.put("/links/:id", async (c) => {
    const body = await c.req.json();
    const link = await updateLink(c.env, c.req.param("id"), body.config);
    return c.json(link);
  });

  protectedApi.delete("/links/:id", async (c) => {
    await deleteLink(c.env, c.req.param("id"));
    return c.json({ ok: true });
  });

  api.route("/", protectedApi);

  return api;
}
