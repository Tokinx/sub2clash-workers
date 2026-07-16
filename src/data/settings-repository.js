import { randomId } from "../utils/crypto.js";
import { badRequest, notFound } from "../utils/errors.js";
import { SETTINGS_KEY } from "./keys.js";
import { invalidateLinksByTemplate } from "./cache-dependencies.js";

const MAX_TEMPLATE_COUNT = 20;
const MAX_TEMPLATE_BYTES = 128 * 1024;

export function createDefaultSettings() {
  return {
    version: 1,
    defaults: {
      target: "meta",
      templateId: "meta-default",
      sort: "nameasc"
    },
    templates: []
  };
}

function normalizeSettings(settings) {
  const fallback = createDefaultSettings();
  if (!settings || typeof settings !== "object") {
    return fallback;
  }
  return {
    version: 1,
    defaults: {
      ...fallback.defaults,
      ...(settings.defaults || {})
    },
    templates: Array.isArray(settings.templates) ? settings.templates : []
  };
}

export async function getSettings(env) {
  const stored = await env.CACHE.get(SETTINGS_KEY, "json");
  return normalizeSettings(stored);
}

export async function saveSettings(env, settings) {
  const normalized = normalizeSettings(settings);
  await env.CACHE.put(SETTINGS_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function listCustomTemplates(env) {
  const settings = await getSettings(env);
  return settings.templates;
}

export async function findCustomTemplate(env, id) {
  const settings = await getSettings(env);
  return settings.templates.find((template) => template.id === id) || null;
}

function validateTemplatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    throw badRequest("模板数据格式错误");
  }
  if (!payload.name || typeof payload.name !== "string") {
    throw badRequest("模板名称不能为空");
  }
  if (!["clash", "meta"].includes(payload.target)) {
    throw badRequest("模板目标类型无效");
  }
  if (!payload.content || typeof payload.content !== "string") {
    throw badRequest("模板内容不能为空");
  }
  const bytes = new TextEncoder().encode(payload.content);
  if (bytes.byteLength > MAX_TEMPLATE_BYTES) {
    throw badRequest("模板内容超过大小限制");
  }
}

export async function createTemplate(env, payload) {
  validateTemplatePayload(payload);
  const settings = await getSettings(env);
  if (settings.templates.length >= MAX_TEMPLATE_COUNT) {
    throw badRequest("自建模板数量超过上限");
  }

  const now = new Date().toISOString();
  const template = {
    id: `tpl_${randomId(12)}`,
    name: payload.name.trim(),
    target: payload.target,
    content: payload.content,
    createdAt: now,
    updatedAt: now,
    builtin: false
  };
  settings.templates.push(template);
  await saveSettings(env, settings);
  return template;
}

export async function updateTemplate(env, id, payload) {
  validateTemplatePayload(payload);
  const settings = await getSettings(env);
  const index = settings.templates.findIndex((template) => template.id === id);
  if (index === -1) {
    throw notFound("模板不存在");
  }

  const current = settings.templates[index];
  settings.templates[index] = {
    ...current,
    name: payload.name.trim(),
    target: payload.target,
    content: payload.content,
    updatedAt: new Date().toISOString()
  };
  await invalidateLinksByTemplate(env, id);
  await saveSettings(env, settings);
  return settings.templates[index];
}

export async function deleteTemplate(env, id) {
  const settings = await getSettings(env);
  const index = settings.templates.findIndex((template) => template.id === id);
  if (index === -1) {
    throw notFound("模板不存在");
  }
  await invalidateLinksByTemplate(env, id);
  settings.templates.splice(index, 1);
  await saveSettings(env, settings);
}

export async function duplicateTemplate(env, id) {
  const template = await findCustomTemplate(env, id);
  if (!template) {
    throw notFound("模板不存在");
  }
  return createTemplate(env, {
    name: `${template.name} 副本`,
    target: template.target,
    content: template.content
  });
}
