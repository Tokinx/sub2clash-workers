import { parse, serialize } from "cookie";

import { decodeBase64UrlText, encodeBase64UrlBytes, encodeBase64UrlText } from "../utils/base64url.js";
import { constantTimeEqualStrings, hmacSha256 } from "../utils/crypto.js";
import { unauthorized } from "../utils/errors.js";

const SESSION_COOKIE_NAME = "sub2clash_session";

function getSessionTtl(env) {
  return Number(env.SESSION_TTL_SECONDS || 60 * 60 * 24 * 30);
}

function getSessionSecret(env) {
  // 不允许 fallback 到公开已知密钥：未配置时拒绝签发/验证，
  // 避免任何部署路径下可离线伪造会话
  if (!env.SESSION_SECRET) {
    throw new Error("服务端未配置 SESSION_SECRET");
  }
  return env.SESSION_SECRET;
}

async function signPayload(env, payload) {
  const bytes = await hmacSha256(getSessionSecret(env), payload);
  return encodeBase64UrlBytes(bytes);
}

export async function createSessionToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const payload = encodeBase64UrlText(
    JSON.stringify({
      v: 1,
      iat: now,
      exp: now + getSessionTtl(env)
    })
  );
  const signature = await signPayload(env, payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token, env) {
  if (!token || !token.includes(".")) {
    throw unauthorized();
  }

  const [payload, signature] = token.split(".");
  const expected = await signPayload(env, payload);
  if (!(await constantTimeEqualStrings(signature, expected))) {
    throw unauthorized();
  }

  const decoded = JSON.parse(decodeBase64UrlText(payload));
  const now = Math.floor(Date.now() / 1000);
  if (!decoded.exp || decoded.exp <= now) {
    throw unauthorized();
  }
  return decoded;
}

export async function getSessionFromRequest(request, env) {
  const cookies = parse(request.headers.get("cookie") || "");
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token, env);
  } catch {
    return null;
  }
}

function shouldUseSecureCookie(request) {
  const url = new URL(request.url);
  if (url.protocol === "https:") {
    return true;
  }
  return url.hostname !== "localhost" && url.hostname !== "127.0.0.1";
}

export async function createSessionCookie(env, request) {
  const token = await createSessionToken(env);
  return serialize(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Lax",
    path: "/",
    maxAge: getSessionTtl(env)
  });
}

export function clearSessionCookie(request) {
  return serialize(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: shouldUseSecureCookie(request),
    sameSite: "Lax",
    path: "/",
    maxAge: 0
  });
}
