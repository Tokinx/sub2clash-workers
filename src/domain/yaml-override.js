import YAML from "yaml";

import { stableStringify } from "../utils/object.js";
import { unprocessable } from "../utils/errors.js";

const PATCH_OPERATIONS = new Set(["merge", "replace", "remove", "upsert"]);
const MATCH_OPERATORS = new Set([
  "equals",
  "in",
  "notIn",
  "includes",
  "notIncludes",
  "startsWith",
  "endsWith",
  "regex",
  "exists"
]);

function clone(value) {
  if (value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEqual(left, right) {
  return stableStringify(left) === stableStringify(right);
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

function splitPath(path) {
  return String(path)
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getPathValue(value, path) {
  if (!path) {
    return value;
  }

  const segments = splitPath(path);
  let current = value;

  for (const segment of segments) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment];
  }

  return current;
}

function resolveArrayTarget(root, path, errorPath) {
  if (typeof path !== "string" || !path.trim()) {
    throw unprocessable("patch.target 必须是非空字符串", errorPath);
  }

  const segments = splitPath(path);
  if (!segments.length) {
    throw unprocessable("patch.target 必须是非空字符串", errorPath);
  }

  let parent = root;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    if (!isPlainObject(parent[segment])) {
      throw unprocessable("patch.target 必须指向已存在的对象路径", errorPath);
    }
    parent = parent[segment];
  }

  const key = segments[segments.length - 1];
  if (!Array.isArray(parent[key])) {
    throw unprocessable("patch.target 必须指向数组字段", errorPath);
  }

  return {
    parent,
    key
  };
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

function isOperatorMatcher(condition) {
  if (!isPlainObject(condition)) {
    return false;
  }

  const keys = Object.keys(condition);
  return keys.length > 0 && keys.every((key) => MATCH_OPERATORS.has(key));
}

function compileRegex(pattern, path) {
  try {
    return new RegExp(String(pattern));
  } catch (error) {
    throw unprocessable("match.regex 非法", `${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function evaluateMatchOperator(actual, operator, expected, path) {
  switch (operator) {
    case "equals":
      return isEqual(actual, expected);
    case "in":
      if (!Array.isArray(expected)) {
        throw unprocessable("match.in 必须是数组", path);
      }
      return expected.some((candidate) => isEqual(actual, candidate));
    case "notIn":
      if (!Array.isArray(expected)) {
        throw unprocessable("match.notIn 必须是数组", path);
      }
      return !expected.some((candidate) => isEqual(actual, candidate));
    case "includes":
      if (typeof actual === "string") {
        return actual.includes(String(expected));
      }
      if (Array.isArray(actual)) {
        return actual.some((candidate) => isEqual(candidate, expected));
      }
      return false;
    case "notIncludes":
      return !evaluateMatchOperator(actual, "includes", expected, path);
    case "startsWith":
      return typeof actual === "string" && actual.startsWith(String(expected));
    case "endsWith":
      return typeof actual === "string" && actual.endsWith(String(expected));
    case "regex":
      return typeof actual === "string" && compileRegex(expected, path).test(actual);
    case "exists":
      return Boolean(actual !== undefined) === Boolean(expected);
    default:
      return false;
  }
}

function matchesCondition(actual, condition, path) {
  if (isOperatorMatcher(condition)) {
    return Object.entries(condition).every(([operator, expected]) =>
      evaluateMatchOperator(actual, operator, expected, formatPath(path, operator))
    );
  }

  return isEqual(actual, condition);
}

function matchesItem(item, match, path) {
  if (match === undefined) {
    return true;
  }

  if (!isPlainObject(match)) {
    throw unprocessable("patch.match 必须是对象", path);
  }

  return Object.entries(match).every(([fieldPath, condition]) => {
    const actual = fieldPath === "$self" ? item : getPathValue(item, fieldPath);
    return matchesCondition(actual, condition, formatPath(path, fieldPath));
  });
}

function executeSelect(selectSpec, rootConfig, path) {
  if (!isPlainObject(selectSpec)) {
    throw unprocessable("$select 必须是对象", path);
  }

  if (typeof selectSpec.from !== "string" || !selectSpec.from.trim()) {
    throw unprocessable("$select.from 必须是非空字符串", path);
  }

  const source = getPathValue(rootConfig, selectSpec.from);
  if (!Array.isArray(source)) {
    throw unprocessable("$select.from 必须指向数组字段", formatPath(path, "from"));
  }

  const selected = source.filter((item) =>
    matchesItem(item, selectSpec.where, formatPath(path, "where"))
  );

  const extracted = selected.map((item) => {
    if (!selectSpec.field) {
      return clone(item);
    }

    const value = getPathValue(item, selectSpec.field);
    return value === undefined ? undefined : clone(value);
  });

  return extracted.filter((item) => item !== undefined);
}

function resolveTemplateValue(template, rootConfig, path = "") {
  if (Array.isArray(template)) {
    return template.map((item, index) =>
      resolveTemplateValue(item, rootConfig, `${path}[${index}]`)
    );
  }

  if (isPlainObject(template)) {
    const keys = Object.keys(template);
    if (keys.length === 1 && keys[0] === "$select") {
      return executeSelect(template.$select, rootConfig, path || "$select");
    }

    return Object.fromEntries(
      Object.entries(template).map(([key, value]) => [
        key,
        resolveTemplateValue(value, rootConfig, formatPath(path, key))
      ])
    );
  }

  return clone(template);
}

function resolvePatchValue(patch, rootConfig, path) {
  if (patch.value === undefined) {
    return undefined;
  }

  return resolveTemplateValue(patch.value, rootConfig, formatPath(path, "value"));
}

function mergeMatchedItems(array, matchedIndexes, resolvedValue, path) {
  if (!isPlainObject(resolvedValue)) {
    throw unprocessable("patch.value 必须是对象", formatPath(path, "value"));
  }

  matchedIndexes.forEach((index) => {
    if (!isPlainObject(array[index])) {
      throw unprocessable("patch.merge 仅支持对象数组", path);
    }
    array[index] = mergeObject(array[index], resolvedValue, `${path}[${index}]`);
  });
}

function validatePatchOperation(operation, path) {
  if (!PATCH_OPERATIONS.has(operation)) {
    throw unprocessable("patch.op 仅支持 merge / replace / remove / upsert", path);
  }
}

function applyPatch(rootConfig, patch, path) {
  if (!isPlainObject(patch)) {
    throw unprocessable("patch 必须是对象", path);
  }

  validatePatchOperation(patch.op, formatPath(path, "op"));

  const targetRef = resolveArrayTarget(rootConfig, patch.target, formatPath(path, "target"));
  const array = targetRef.parent[targetRef.key];
  const matchedIndexes = array
    .map((item, index) =>
      matchesItem(item, patch.match, formatPath(path, "match")) ? index : -1
    )
    .filter((index) => index !== -1);

  switch (patch.op) {
    case "merge": {
      if (patch.value === undefined) {
        throw unprocessable("patch.value 不能为空", formatPath(path, "value"));
      }
      const resolvedValue = resolvePatchValue(patch, rootConfig, path);
      if (matchedIndexes.length === 0) {
        return;
      }
      mergeMatchedItems(array, matchedIndexes, resolvedValue, path);
      return;
    }
    case "replace": {
      if (patch.value === undefined) {
        throw unprocessable("patch.value 不能为空", formatPath(path, "value"));
      }
      const resolvedValue = resolvePatchValue(patch, rootConfig, path);
      matchedIndexes.forEach((index) => {
        array[index] = clone(resolvedValue);
      });
      return;
    }
    case "remove": {
      targetRef.parent[targetRef.key] = array.filter((_, index) => !matchedIndexes.includes(index));
      return;
    }
    case "upsert": {
      if (patch.value === undefined) {
        throw unprocessable("patch.value 不能为空", formatPath(path, "value"));
      }
      const resolvedValue = resolvePatchValue(patch, rootConfig, path);
      if (matchedIndexes.length > 0) {
        if (isPlainObject(resolvedValue)) {
          mergeMatchedItems(array, matchedIndexes, resolvedValue, path);
          return;
        }

        matchedIndexes.forEach((index) => {
          array[index] = clone(resolvedValue);
        });
        return;
      }

      const position = patch.position || "end";
      if (!["start", "end"].includes(position)) {
        throw unprocessable("patch.position 仅支持 start 或 end", formatPath(path, "position"));
      }

      if (position === "start") {
        targetRef.parent[targetRef.key] = [clone(resolvedValue), ...array];
      } else {
        targetRef.parent[targetRef.key] = [...array, clone(resolvedValue)];
      }
      return;
    }
    default:
      return;
  }
}

function applyPatches(baseConfig, patches) {
  if (patches === undefined) {
    return clone(baseConfig);
  }

  if (!Array.isArray(patches)) {
    throw unprocessable("$patches 必须是数组", "$patches");
  }

  const next = clone(baseConfig);
  patches.forEach((patch, index) => {
    applyPatch(next, patch, `$patches[${index}]`);
  });
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

  const plainOverride = clone(overrideObject);
  const patches = plainOverride.$patches;
  delete plainOverride.$patches;

  const merged = mergeObject(baseConfig, plainOverride);
  return applyPatches(merged, patches);
}
