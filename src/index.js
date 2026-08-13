import { Hono } from "hono";
import { WorkerEntrypoint } from "cloudflare:workers";

import { AppError } from "./utils/errors.js";
import { createApiRouter } from "./routes/api.js";
import { handleSubscriptionRequest } from "./domain/subscription-output.js";

const app = new Hono();

function errorToResponse(error) {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: error.message,
        details: error.details
      },
      { status: error.status }
    );
  }

  console.error(error);
  return Response.json(
    {
      error: "服务内部错误"
    },
    { status: 500 }
  );
}

app.onError((error) => errorToResponse(error));

app.route("/api", createApiRouter());

// 未匹配的 /api/* 返回 404 JSON，避免落入 SPA fallback 返回 200 HTML
app.all("/api/*", (c) =>
  c.json(
    {
      error: "接口不存在"
    },
    404
  )
);

app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));

// 订阅输出在 Hono 路由之外分发，统一在此做错误到 HTTP 响应的转换
async function dispatchSubscriptionRequest(env, ctx, request) {
  try {
    return await handleSubscriptionRequest(env, ctx, request);
  } catch (error) {
    return errorToResponse(error);
  }
}

// 订阅输出缓存入口：wrangler 配置对该 entrypoint 启用 Workers Caching，
// 命中缓存时整个 fetch 不执行（read-through 由平台完成）。
export class SubscriptionEntrypoint extends WorkerEntrypoint {
  fetch(request) {
    return dispatchSubscriptionRequest(this.env, this.ctx, request);
  }

  // RPC 方法（绕过缓存层）：在缓存入口作用域内按标签清除缓存条目，
  // 供管理台变更链接/模板/订阅后精确失效，不受 TTL 窗口影响
  async purgeByTags(tags) {
    const result = await this.ctx.cache.purge({ tags });
    return result.success;
  }
}

// 默认入口（gateway）：Workers Caching 关闭，所有逻辑每次执行。
// /s/ 与 /sub/ 路径转发到缓存入口；无 exports 的环境（如测试）直接内联处理。
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/s/") || url.pathname.startsWith("/sub/")) {
      if (ctx?.exports?.SubscriptionEntrypoint) {
        return ctx.exports.SubscriptionEntrypoint.fetch(request);
      }
      return dispatchSubscriptionRequest(env, ctx, request);
    }
    return app.fetch(request, env, ctx);
  }
};
