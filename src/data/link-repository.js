import { randomId } from "../utils/crypto.js";
import { badRequest, notFound } from "../utils/errors.js";
import { buildLinkKey } from "./keys.js";

function validateId(id) {
  if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) {
    throw badRequest("短链 ID 格式无效");
  }
}

function normalizeLinkRemark(remark) {
  if (remark === undefined || remark === null) {
    return "";
  }

  if (typeof remark !== "string") {
    throw badRequest("短链备注格式无效");
  }

  const normalized = remark.trim();
  if (Array.from(normalized).length > 100) {
    throw badRequest("短链备注不能超过 100 个字符");
  }

  return normalized;
}

function buildLinkSummary(record) {
  return {
    id: record.id,
    remark: typeof record.remark === "string" ? record.remark : "",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

async function putLinkRecord(env, record) {
  await env.CACHE.put(buildLinkKey(record.id), JSON.stringify(record), {
    metadata: buildLinkSummary(record)
  });
}

export async function createLink(env, config, remark) {
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
    remark: normalizeLinkRemark(remark),
    config,
    createdAt: now,
    updatedAt: now
  };
  await putLinkRecord(env, record);
  return record;
}

export async function listLinks(env) {
  const listed = await env.CACHE.list({ prefix: buildLinkKey("") });
  const records = await Promise.all(
    listed.keys.map(async (item) => {
      if (item.metadata?.id && item.metadata?.createdAt && item.metadata?.updatedAt) {
        return buildLinkSummary(item.metadata);
      }

      const record = await env.CACHE.get(item.name, "json");
      return record ? buildLinkSummary(record) : null;
    })
  );

  return records
    .filter(Boolean)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export async function getLink(env, id) {
  validateId(id);
  const record = await env.CACHE.get(buildLinkKey(id), "json");
  if (!record) {
    throw notFound("短链不存在");
  }
  return {
    ...record,
    remark: typeof record.remark === "string" ? record.remark : ""
  };
}

export async function updateLink(env, id, config, remark) {
  const record = await getLink(env, id);
  const nextRecord = {
    ...record,
    remark: remark === undefined ? record.remark : normalizeLinkRemark(remark),
    config,
    updatedAt: new Date().toISOString()
  };
  await putLinkRecord(env, nextRecord);
  return nextRecord;
}

export async function deleteLink(env, id) {
  await getLink(env, id);
  await env.CACHE.delete(buildLinkKey(id));
}
