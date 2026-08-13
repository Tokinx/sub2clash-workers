import { Hono } from "hono";

import { AppError } from "./utils/errors.js";
import { decodeBase64UrlText } from "./utils/base64url.js";
import { syncLinkCacheDependencies } from "./data/cache-dependencies.js";
import { putCachedLinkOutput } from "./data/link-output-cache.js";
import { createApiRouter } from "./routes/api.js";
import { renderConfig, renderLink } from "./domain/render.js";

const app = new Hono();

// /sub/:payload 的 payload 即配置指纹：URL 变化即新缓存，边缘缓存可放心使用长 TTL
const LONG_PAYLOAD_EDGE_TTL_SECONDS = 21_600;
// /s/:id 的链接配置可被修改，边缘缓存使用短 TTL 兜底，
// 精确失效仍由 KV 输出缓存的 invalidateLinkCaches 承担
const SHORT_LINK_EDGE_TTL_SECONDS = 300;

// 缓存回写放到后台执行：真实运行时用 ExecutionContext.waitUntil（不阻塞响应），
// 无 ExecutionContext 的环境（如测试）直接等待，保证行为可断言
function writeCacheInBackground(env, tasks) {
  const context = env?.context ?? env?.ctx;
  const work = Promise.allSettled(tasks);
  if (context?.waitUntil) {
    context.waitUntil(work);
    return;
  }
  return work;
}

app.onError((error, c) => {
  if (error instanceof AppError) {
    return c.json(
      {
        error: error.message,
        details: error.details
      },
      error.status
    );
  }

  console.error(error);
  return c.json(
    {
      error: "服务内部错误"
    },
    500
  );
});

app.get("/sub/:payload", async (c) => {
  const payload = c.req.param("payload");
  const config = JSON.parse(decodeBase64UrlText(payload));
  const result = await renderConfig(c.env, c.req.raw, config);
  if (result.subscriptionUserinfo) {
    c.header("subscription-userinfo", result.subscriptionUserinfo);
  }
  c.header("content-type", "text/yaml; charset=utf-8");
  c.header(
    "Cache-Control",
    config?.options?.refresh === true
      ? "no-store"
      : `public, s-maxage=${LONG_PAYLOAD_EDGE_TTL_SECONDS}`
  );
  return c.body(result.yaml);
});

app.get("/s/:id", async (c) => {
  const id = c.req.param("id");
  const result = await renderLink(c.env, c.req.raw, id);
  if (result.subscriptionUserinfo) {
    c.header("subscription-userinfo", result.subscriptionUserinfo);
  }
  c.header("content-type", "text/yaml; charset=utf-8");

  if (result.cacheable === false) {
    c.header("Cache-Control", "no-store");
    return c.body(result.yaml);
  }

  c.header("Cache-Control", `public, s-maxage=${SHORT_LINK_EDGE_TTL_SECONDS}`);
  // 缓存命中的响应不含 dependencies（渲染时才有），无需回写；
  // 新渲染结果在后台并行写 KV，失败不影响响应
  if (result.dependencies) {
    const { yaml, subscriptionUserinfo, stats, warnings } = result;
    await writeCacheInBackground(c.env, [
      syncLinkCacheDependencies(c.env, id, result.dependencies),
      putCachedLinkOutput(c.env, id, { yaml, subscriptionUserinfo, stats, warnings })
    ]);
  }
  return c.body(result.yaml);
});

app.route("/api", createApiRouter());

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
