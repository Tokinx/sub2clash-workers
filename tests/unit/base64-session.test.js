import { describe, expect, it } from "vitest";

import { decodeBase64UrlText, encodeBase64UrlText } from "../../src/utils/base64url.js";
import { createSessionToken, verifySessionToken, getSessionFromRequest } from "../../src/auth/session.js";
import { createEnv } from "../helpers/env.js";

describe("base64url", () => {
  it("可以稳定编码与解码 Unicode 文本", () => {
    const source = "香港节点 / OpenAI / 测试";
    const encoded = encodeBase64UrlText(source);
    expect(decodeBase64UrlText(encoded)).toBe(source);
  });
});

describe("session", () => {
  it("可以生成并验证会话 token", async () => {
    const env = createEnv();
    const token = await createSessionToken(env);
    const payload = await verifySessionToken(token, env);
    expect(payload.v).toBe(1);
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it("篡改 payload 或签名后验证失败", async () => {
    const env = createEnv();
    const token = await createSessionToken(env);
    const [payload, signature] = token.split(".");

    const tamperedPayload = encodeBase64UrlText(
      JSON.stringify({ v: 1, iat: 0, exp: 9999999999 })
    );
    await expect(verifySessionToken(`${tamperedPayload}.${signature}`, env)).rejects.toMatchObject({
      status: 401
    });

    const flipped = signature[signature.length - 1] === "A" ? "B" : "A";
    const badSignature = `${signature.slice(0, -1)}${flipped}`;
    await expect(verifySessionToken(`${payload}.${badSignature}`, env)).rejects.toMatchObject({
      status: 401
    });
  });

  it("过期 token 验证失败", async () => {
    const env = createEnv({ SESSION_TTL_SECONDS: "-1" });
    const token = await createSessionToken(env);
    await expect(verifySessionToken(token, env)).rejects.toMatchObject({ status: 401 });
  });

  it("错误 secret 签发的 token 验证失败", async () => {
    const env = createEnv({ SESSION_SECRET: "test-session-secret" });
    const otherEnv = createEnv({ SESSION_SECRET: "another-secret" });
    const token = await createSessionToken(env);
    await expect(verifySessionToken(token, otherEnv)).rejects.toMatchObject({ status: 401 });
  });

  it("缺少 SESSION_SECRET 时拒绝签发会话", async () => {
    const env = createEnv({ SESSION_SECRET: undefined });
    await expect(createSessionToken(env)).rejects.toThrow("SESSION_SECRET");
    const request = new Request("https://app.example.com/");
    expect(await getSessionFromRequest(request, env)).toBeNull();
  });
});
