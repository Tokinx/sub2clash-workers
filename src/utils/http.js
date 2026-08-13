import { AppError, badRequest, unprocessable } from "./errors.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchTextWithRetry(url, options = {}) {
  const {
    headers = {},
    timeoutMs = 10_000,
    retries = 2,
    maxBytes = 1_048_576,
    noStore = false
  } = options;

  const target = new URL(url);
  if (!["http:", "https:"].includes(target.protocol)) {
    throw badRequest("订阅地址仅支持 http/https");
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);

    try {
      const fetchOptions = {
        headers,
        redirect: "follow",
        signal: controller.signal
      };
      if (noStore) {
        fetchOptions.cache = "no-store";
      }

      const response = await fetch(target.toString(), fetchOptions);

      if (!response.ok) {
        // 5xx 抛普通 Error 走重试路径；4xx 抛 AppError 视为永久性错误
        if (response.status >= 500) {
          throw new Error(`远程请求失败: ${response.status}`);
        }
        throw unprocessable(`远程请求失败: ${response.status}`);
      }

      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength && contentLength > maxBytes) {
        throw unprocessable("远程内容超过大小限制");
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw unprocessable("远程内容超过大小限制");
      }

      return {
        text: new TextDecoder().decode(buffer),
        headers: response.headers
      };
    } catch (error) {
      lastError = error;
      // 4xx 类（含内容超限）是永久性错误，重试无意义且浪费计费出站请求；
      // 仅对 5xx、超时、网络错误进行退避重试
      const shouldRetry = !(error instanceof AppError && error.status < 500);
      if (!shouldRetry || attempt === retries) {
        if (error instanceof AppError) {
          throw error;
        }
        throw unprocessable("远程请求失败", error instanceof Error ? error.message : String(error));
      }
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}
