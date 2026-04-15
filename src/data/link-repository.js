import { randomId } from "../utils/crypto.js";
import { badRequest, notFound } from "../utils/errors.js";
import { buildLinkKey } from "./keys.js";

function validateId(id) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    throw badRequest("短链 ID 格式无效");
  }
}

export async function createLink(env, config) {
  const id = randomId(20);
  validateId(id);
  const key = buildLinkKey(id);
  const exists = await env.CACHE.get(key);
  if (exists) {
    throw badRequest("短链已存在");
  }

  const now = new Date().toISOString();
  const record = {
    id,
    config,
    createdAt: now,
    updatedAt: now
  };
  await env.CACHE.put(key, JSON.stringify(record));
  return record;
}

export async function getLink(env, id) {
  validateId(id);
  const record = await env.CACHE.get(buildLinkKey(id), "json");
  if (!record) {
    throw notFound("短链不存在");
  }
  return record;
}

export async function updateLink(env, id, config) {
  const record = await getLink(env, id);
  const nextRecord = {
    ...record,
    config,
    updatedAt: new Date().toISOString()
  };
  await env.CACHE.put(buildLinkKey(id), JSON.stringify(nextRecord));
  return nextRecord;
}

export async function deleteLink(env, id) {
  await getLink(env, id);
  await env.CACHE.delete(buildLinkKey(id));
}
