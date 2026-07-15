import { badRequest, unprocessable } from "./errors.js";

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
      if (attempt === retries) {
        throw unprocessable("远程请求失败", error instanceof Error ? error.message : String(error));
      }
      await sleep(200 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}
