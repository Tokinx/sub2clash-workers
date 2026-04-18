import YAML from "yaml";

import { unprocessable } from "../utils/errors.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function unwrapEscapedKey(key) {
  if (typeof key === "string" && key.startsWith("<") && key.endsWith(">")) {
    return key.slice(1, -1);
  }

  return key;
}

function parseOverrideKey(rawKey) {
  if (rawKey.startsWith("+")) {
    return {
      key: unwrapEscapedKey(rawKey.slice(1)),
      mode: "prepend"
    };
  }

  if (rawKey.startsWith("<") && rawKey.endsWith(">")) {
    return {
      key: rawKey.slice(1, -1),
      mode: "merge"
    };
  }

  if (rawKey.endsWith("!")) {
    return {
      key: unwrapEscapedKey(rawKey.slice(0, -1)),
      mode: "replace"
    };
  }

  if (rawKey.endsWith("+")) {
    return {
      key: unwrapEscapedKey(rawKey.slice(0, -1)),
      mode: "append"
    };
  }

  return {
    key: unwrapEscapedKey(rawKey),
    mode: "merge"
  };
}

function formatPath(path, key) {
  return path ? `${path}.${key}` : key;
}

function mergeArray(baseValue, incomingValue, mode, path) {
  if (!Array.isArray(incomingValue)) {
    throw unprocessable("覆写数组操作的值必须是数组", path);
  }

  if (baseValue !== undefined && !Array.isArray(baseValue)) {
    throw unprocessable("覆写数组操作仅支持数组字段", path);
  }

  const current = Array.isArray(baseValue) ? clone(baseValue) : [];
  const incoming = clone(incomingValue);
  return mode === "prepend" ? [...incoming, ...current] : [...current, ...incoming];
}

function mergeValue(baseValue, incomingValue, path) {
  if (isPlainObject(incomingValue)) {
    return mergeObject(isPlainObject(baseValue) ? baseValue : {}, incomingValue, path);
  }

  return clone(incomingValue);
}

function mergeObject(baseObject, overrideObject, path = "") {
  const next = clone(baseObject);

  for (const [rawKey, incomingValue] of Object.entries(overrideObject)) {
    const { key, mode } = parseOverrideKey(rawKey);
    const nextPath = formatPath(path, key);
    const currentValue = next[key];

    if (mode === "replace") {
      next[key] = clone(incomingValue);
      continue;
    }

    if (mode === "prepend" || mode === "append") {
      next[key] = mergeArray(currentValue, incomingValue, mode, nextPath);
      continue;
    }

    next[key] = mergeValue(currentValue, incomingValue, nextPath);
  }

  return next;
}

export function applyYamlOverride(baseConfig, overrideContent) {
  if (!overrideContent.trim()) {
    return clone(baseConfig);
  }

  let overrideObject;
  try {
    overrideObject = YAML.parse(overrideContent);
  } catch (error) {
    throw unprocessable("覆写 YAML 解析失败", error instanceof Error ? error.message : String(error));
  }

  if (!isPlainObject(overrideObject)) {
    throw unprocessable("覆写 YAML 顶层必须是对象");
  }

  return mergeObject(baseConfig, overrideObject);
}
