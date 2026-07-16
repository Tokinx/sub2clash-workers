export const SETTINGS_KEY = "settings";

export function buildLinkKey(id) {
  return `link:${id}`;
}

export function buildSubscriptionCacheKey(hash) {
  return `cache:sub:${hash}`;
}

export function buildLinkYamlCacheKey(id) {
  return `cache:link-yaml:${id}`;
}

export function buildLinkDependencyKey(id) {
  return `cache:deps:link:${id}`;
}

export function buildSourceDependentsKey(hash) {
  return `cache:deps:source:${hash}`;
}

export function buildTemplateDependentsKey(id) {
  return `cache:deps:template:${id}`;
}

export function buildChildLinkDependentsKey(id) {
  return `cache:deps:child:${id}`;
}
