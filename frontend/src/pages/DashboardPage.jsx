import { AlertCircle, Copy, Eye, Link2, RefreshCw, Search, Trash2, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import YAML from "yaml";

import Field from "@/components/Field";
import LinkAutocomplete from "@/components/dashboard/LinkAutocomplete.jsx";
import PreviewDialog from "@/components/dashboard/PreviewDialog.jsx";
import {
  EditorSection,
  ReplacementEditor,
  RuleProviderEditor,
  RulesEditor,
  SubscriptionEditor,
  cleanSubscriptions,
  normalizeNodes,
} from "@/components/dashboard/editors.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api.js";
import { createEmptyConfig, decodeConfigPayload, encodeConfigPayload, normalizeConfig } from "@/lib/config.js";

const LONG_LINK_SOFT_LIMIT = 15_500;

function OptionToggle({ label, description, checked, onCheckedChange }) {
  return (
    <label className="flex min-h-[var(--control-height)] items-center justify-between bg-[rgba(255,255,255,0.82)] p-4 text-sm">
      <div className="space-y-0.5 pr-4">
        <div className="pr-3 leading-6">{label}</div>
        {description && <p className="text-muted-foreground/60 text-xs">{description}</p>}
      </div>

      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </label>
  );
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.setAttribute("readonly", "");
  input.style.position = "absolute";
  input.style.left = "-9999px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

export default function DashboardPage({ templates }) {
  const [config, setConfig] = useState(createEmptyConfig());
  const [nodesText, setNodesText] = useState("");
  const [preview, setPreview] = useState("");
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [pageError, setPageError] = useState("");
  const [pageMessage, setPageMessage] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [savedLinks, setSavedLinks] = useState([]);
  const [savedLinksLoading, setSavedLinksLoading] = useState(false);
  const [shortLinkId, setShortLinkId] = useState("");
  const [subscriptionInfo, setSubscriptionInfo] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  const templateOptions = useMemo(() => {
    const builtin = templates.builtin.map((item) => ({
      value: `builtin:${item.id}`,
      label: `${item.name} / ${item.target}`,
    }));
    const custom = templates.custom.map((item) => ({
      value: `custom:${item.id}`,
      label: `${item.name} / ${item.target}`,
    }));
    return [...builtin, ...custom];
  }, [templates]);

  const effectiveConfig = useMemo(
    () => ({
      ...config,
      sources: {
        ...config.sources,
        subscriptions: cleanSubscriptions(config.sources.subscriptions),
        nodes: normalizeNodes(nodesText),
      },
    }),
    [config, nodesText],
  );

  const longLink = useMemo(
    () => `${window.location.origin}/sub/${encodeConfigPayload(effectiveConfig)}`,
    [effectiveConfig],
  );

  const shortLink = shortLinkId ? `${window.location.origin}/s/${shortLinkId}` : "";
  const canCopyLongLink = longLink.length < LONG_LINK_SOFT_LIMIT;
  const savedLinkOptions = useMemo(
    () =>
      savedLinks.map((item) => ({
        ...item,
        path: `/s/${item.id}`,
        url: `${window.location.origin}/s/${item.id}`,
      })),
    [savedLinks],
  );

  useEffect(() => {
    if (!templateOptions.length) {
      return;
    }

    const available = templateOptions.some(
      (option) => option.value === `${config.template.mode}:${config.template.value}`,
    );

    if (!available) {
      const [mode, value] = templateOptions[0].value.split(":");
      setConfig((current) => ({
        ...current,
        template: { mode, value },
      }));
    }
  }, [config.template.mode, config.template.value, templateOptions]);

  useEffect(() => {
    let cancelled = false;

    async function loadSavedLinks() {
      setSavedLinksLoading(true);
      try {
        const data = await apiFetch("/api/links");
        if (!cancelled) {
          setSavedLinks(Array.isArray(data.links) ? data.links : []);
        }
      } catch {
        if (!cancelled) {
          setSavedLinks([]);
        }
      } finally {
        if (!cancelled) {
          setSavedLinksLoading(false);
        }
      }
    }

    loadSavedLinks();

    return () => {
      cancelled = true;
    };
  }, []);

  function showSuccess(message) {
    setPageError("");
    setPageMessage(message);
  }

  function showError(message) {
    setPageMessage("");
    setPageError(message);
  }

  function upsertSavedLink(link) {
    const summary = {
      id: link.id,
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
    };

    setSavedLinks((current) =>
      [...current.filter((item) => item.id !== summary.id), summary].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    );
  }

  function updateTemplate(value) {
    const [mode, templateId] = value.split(":");
    setConfig((current) => ({
      ...current,
      template: {
        mode,
        value: templateId,
      },
    }));
  }

  function formatOverrideYaml() {
    if (!config.override.content.trim()) {
      showError("覆写内容为空，无需格式化");
      return;
    }

    try {
      const formattedContent = YAML.stringify(YAML.parse(config.override.content));
      setConfig((current) => ({
        ...current,
        override: {
          ...current.override,
          content: formattedContent,
        },
      }));
      showSuccess("覆写 YAML 已格式化");
    } catch (error) {
      showError(error.message || "覆写 YAML 格式错误，无法格式化");
    }
  }

  async function renderCurrentConfig() {
    setPreviewLoading(true);
    setPreviewError("");
    setPreviewOpen(true);

    try {
      const data = await apiFetch("/api/render", {
        method: "POST",
        body: JSON.stringify(effectiveConfig),
      });
      setPreview(data.yaml);
      setStats(data.stats);
      setWarnings(data.warnings || []);
      setSubscriptionInfo(data.subscriptionUserinfo || "");
    } catch (error) {
      setPreview("");
      setStats(null);
      setWarnings([]);
      setSubscriptionInfo("");
      setPreviewError(error.message || "预览失败");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function importLink() {
    try {
      const rawInput = linkInput.trim();
      if (!rawInput) {
        showError("请输入待解析的链接。");
        return;
      }

      const url = rawInput.startsWith("/") ? new URL(rawInput, window.location.origin) : new URL(rawInput);

      if (url.pathname.startsWith("/sub/")) {
        const payload = url.pathname.split("/").pop();
        const nextConfig = decodeConfigPayload(payload);
        setConfig(nextConfig);
        setNodesText((nextConfig.sources?.nodes || []).join("\n"));
        setShortLinkId("");
        showSuccess("已解析长链接配置");
        return;
      }

      if (url.pathname.startsWith("/s/")) {
        const id = url.pathname.split("/").pop();
        const data = await apiFetch(`/api/links/${id}`);
        const nextConfig = normalizeConfig(data.config);
        setConfig(nextConfig);
        setNodesText((nextConfig.sources?.nodes || []).join("\n"));
        setShortLinkId(data.id);
        showSuccess("已导入短链接配置");
        return;
      }

      showError("暂不支持该链接格式。");
    } catch (error) {
      showError(error.message || "导入失败。");
    }
  }

  async function createShortLink() {
    try {
      const data = await apiFetch("/api/links", {
        method: "POST",
        body: JSON.stringify({
          config: effectiveConfig,
        }),
      });
      setShortLinkId(data.id);
      upsertSavedLink(data);
      showSuccess("短链接已生成");
    } catch (error) {
      showError(error.message || "生成短链接失败。");
    }
  }

  async function updateShortLink() {
    if (!shortLinkId) {
      return;
    }

    try {
      const link = await apiFetch(`/api/links/${shortLinkId}`, {
        method: "PUT",
        body: JSON.stringify({ config: effectiveConfig }),
      });
      upsertSavedLink(link);
      showSuccess("短链接已更新");
    } catch (error) {
      showError(error.message || "更新短链接失败。");
    }
  }

  async function removeShortLink() {
    if (!shortLinkId) {
      return;
    }

    try {
      await apiFetch(`/api/links/${shortLinkId}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      setSavedLinks((current) => current.filter((item) => item.id !== shortLinkId));
      setShortLinkId("");
      showSuccess("短链接已删除");
    } catch (error) {
      showError(error.message || "删除短链接失败。");
    }
  }

  async function copyLongLink() {
    try {
      await copyText(longLink);
      showSuccess("长链接已复制");
    } catch (error) {
      showError(error.message || "复制长链接失败。");
    }
  }

  async function copyShortLink() {
    try {
      await copyText(shortLink);
      showSuccess("短链接已复制");
    } catch (error) {
      showError(error.message || "复制短链接失败。");
    }
  }

  //pageMessage 和 pageError 只会显示 5 秒
  useEffect(() => {
    if (pageMessage || pageError) {
      const timer = setTimeout(() => {
        setPageMessage("");
        setPageError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pageMessage, pageError]);

  return (
    <>
      <div className="mx-auto max-w-6xl">
        <div className="space-y-6">
          <section className="my-[5%]">
            <div className="grid gap-4 grid-cols-[minmax(0,1fr)_auto] items-end">
              <Field className="min-w-0">
                <LinkAutocomplete
                  value={linkInput}
                  options={savedLinkOptions}
                  loading={savedLinksLoading}
                  placeholder="选择或输入历史订阅链接"
                  onChange={setLinkInput}
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <Button type="button" className="lg:min-w-[7rem]" onClick={importLink}>
                  <Search className="h-4 w-4" />
                  <span>解析</span>
                </Button>
              </div>
            </div>

            {pageMessage ? (
              <Alert
                className="fixed top-0 left-0 right-0 pt-6 pb-6 backdrop-blur-xs bg-linear-0 from-transparent to-white z-50 text-center justify-center"
                variant="success"
              >
                <AlertDescription>{pageMessage}</AlertDescription>
              </Alert>
            ) : null}

            {pageError ? (
              <Alert
                className="fixed top-0 left-0 right-0 pt-6 pb-6 backdrop-blur-xs bg-transparent! bg-linear-0 from-transparent to-primary/30 z-50 text-center justify-center"
                variant="destructive"
              >
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{pageError}</AlertDescription>
              </Alert>
            ) : null}
          </section>

          <EditorSection eyebrow="Convert" title="订阅聚合" description="支持多个订阅地址与单节点混合输入">
            <SubscriptionEditor
              subscriptions={config.sources.subscriptions}
              onChange={(subscriptions) =>
                setConfig((current) => ({
                  ...current,
                  sources: {
                    ...current.sources,
                    subscriptions,
                  },
                }))
              }
            />

            <Field label="单节点输入" className="mt-5">
              <Textarea
                rows={7}
                value={nodesText}
                placeholder={"每行一个节点分享链接，\nvmess://...\nss://..."}
                onChange={(event) => setNodesText(event.target.value)}
              />
            </Field>
          </EditorSection>

          <EditorSection eyebrow="Advanced" title="进阶配置" description="选择目标类型&模板，调整输出选项">
            <div className="grid gap-4 xl:grid-cols-3">
              <Field label="目标">
                <Select
                  value={config.target}
                  onValueChange={(value) => setConfig((current) => ({ ...current, target: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标类型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meta">Clash.Meta</SelectItem>
                    <SelectItem value="clash">Clash</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="模板">
                <Select value={`${config.template.mode}:${config.template.value}`} onValueChange={updateTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {templateOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="国家组排序">
                <Select
                  value={config.options.sort}
                  onValueChange={(value) =>
                    setConfig((current) => ({
                      ...current,
                      options: { ...current.options, sort: value },
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择排序方式" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nameasc">名称升序</SelectItem>
                    <SelectItem value="namedesc">名称降序</SelectItem>
                    <SelectItem value="sizeasc">数量升序</SelectItem>
                    <SelectItem value="sizedesc">数量降序</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-5 grid gap-[1px] sm:grid-cols-2 xl:grid-cols-3">
              <OptionToggle
                label="强制刷新订阅缓存"
                description="启用后每次预览或生成链接都会向服务端请求最新渲染结果，适合调试订阅更新频率较高的配置。"
                checked={Boolean(config.options.refresh)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, refresh: value },
                  }))
                }
              />
              <OptionToggle
                label="国家组测速"
                description="启用后会自动对国家组内的节点进行测速，以选择最优节点。"
                checked={Boolean(config.options.autoTest)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, autoTest: value },
                  }))
                }
              />
              <OptionToggle
                label="Lazy 模式"
                description="启用后会在 Clash.Meta 中启用 Lazy url-test 模式，适合节点较多的用户。"
                checked={Boolean(config.options.lazy)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, lazy: value },
                  }))
                }
              />
              <OptionToggle
                label="仅输出节点列表"
                description="启用后订阅链接只会输出节点列表，不包含模板内容和其他配置信息。"
                checked={Boolean(config.options.nodeList)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, nodeList: value },
                  }))
                }
              />
              <OptionToggle
                label="忽略国家分组"
                description="启用后会将所有节点视为同一国家组，适合不需要国家分组功能的用户。"
                checked={Boolean(config.options.ignoreCountryGroup)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, ignoreCountryGroup: value },
                  }))
                }
              />
              <OptionToggle
                label="启用 UDP"
                description="启用后会在 Clash.Meta 中启用 UDP 转发功能，适合需要 UDP 支持的用户。"
                checked={Boolean(config.options.useUDP)}
                onCheckedChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, useUDP: value },
                  }))
                }
              />
            </div>

            <Field label="User-Agent" className="mt-3">
              <Input
                value={config.options.userAgent}
                placeholder="获取远程订阅时携带的 User-Agent 标识（可选）"
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, userAgent: event.target.value },
                  }))
                }
              />
            </Field>
          </EditorSection>

          <EditorSection eyebrow="Routing" title="规则增强" description="支持订阅 Rule Provider 和自定义 Rules">
            <RuleProviderEditor
              providers={config.routing.ruleProviders}
              onChange={(ruleProviders) =>
                setConfig((current) => ({
                  ...current,
                  routing: {
                    ...current.routing,
                    ruleProviders,
                  },
                }))
              }
            />
            <div className="h-6"></div>
            <RulesEditor
              rules={config.routing.rules}
              onChange={(rules) =>
                setConfig((current) => ({
                  ...current,
                  routing: {
                    ...current.routing,
                    rules,
                  },
                }))
              }
            />
          </EditorSection>

          <EditorSection eyebrow="Transforms" title="过滤与替换" description="基于正则的节点过滤和节点名称替换">
            <Field label="过滤">
              <Input
                value={config.transforms.filterRegex}
                placeholder="(过期|测试)"
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    transforms: {
                      ...current.transforms,
                      filterRegex: event.target.value,
                    },
                  }))
                }
              />
            </Field>

            <div className="mt-6">
              <p className="mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-[var(--stone)]">替换</p>
              <ReplacementEditor
                replacements={config.transforms.replacements}
                onChange={(replacements) =>
                  setConfig((current) => ({
                    ...current,
                    transforms: {
                      ...current.transforms,
                      replacements,
                    },
                  }))
                }
              />
            </div>
          </EditorSection>

          <EditorSection
            eyebrow="Override"
            title="配置覆写"
            description="支持 Mihomo YAML 覆写语法，在模板合并、规则增强和节点整理之后最终生效"
          >
            <Textarea
              rows={11}
              aria-label="覆写内容"
              value={config.override.content}
              placeholder={
                '$patches:\n  - target: proxies\n    op: merge\n    match:\n      name:\n        includes: "| 落地"\n    value:\n      dialer-proxy: 前置节点'
              }
              onChange={(event) =>
                setConfig((current) => ({
                  ...current,
                  override: {
                    ...current.override,
                    content: event.target.value,
                  },
                }))
              }
            />

            <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
              <Button
                type="button"
                variant="secondary"
                className="px-3 h-8 text-xs"
                aria-label="格式化覆写 YAML"
                onClick={formatOverrideYaml}
              >
                <span>格式化 YAML</span>
              </Button>
              <p className="text-sm leading-6 text-muted-foreground">
                高级语法支持 <code className="bg-primary/10 px-1.5 py-0.5">$patches</code>{" "}
                <code className="bg-primary/10 px-1.5 py-0.5">$select</code>{" "}
                <a
                  className="ml-1 text-primary inline-flex items-center hover:underline"
                  href="https://tokinx.github.io/sub2clash-workers/.docs/override.md"
                  target="_blank"
                >
                  查看文档
                  <ExternalLink className="w-3 h-3 inline ml-1" />
                </a>
              </p>
            </div>
          </EditorSection>

          <EditorSection
            eyebrow="Share"
            title="订阅链接"
            description="长链接会直接携带整个配置，超过长度限制时建议使用短链接"
          >
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <Field className="min-w-0">
                <Input readOnly value={longLink} spellCheck={false} className="font-mono text-[0.84rem]" />
              </Field>

              <div className="flex flex-wrap items-center gap-3 xl:self-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="whitespace-nowrap"
                  aria-label="复制长链接"
                  onClick={copyLongLink}
                >
                  <Copy className="h-4 w-4" />
                  <span>复制</span>
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="whitespace-nowrap"
                  aria-label="预览 YAML"
                  onClick={renderCurrentConfig}
                >
                  <Eye className="h-4 w-4" />
                  <span>预览</span>
                </Button>
                <Button type="button" className="whitespace-nowrap" onClick={createShortLink}>
                  <Link2 className="h-4 w-4" />
                  <span>生成短链接</span>
                </Button>
              </div>
            </div>

            {!canCopyLongLink ? (
              <p className="mt-3 text-sm text-[var(--error)]">长链接接近 Workers URL 限制，建议生成短链接。</p>
            ) : null}

            {shortLinkId ? (
              <div className="mt-5 border-t border-border pt-5">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Field label="当前短链" className="min-w-0">
                    <Input readOnly value={shortLink} className="font-mono text-[0.84rem]" />
                  </Field>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="secondary" aria-label="复制短链接" onClick={copyShortLink}>
                      <Copy className="h-4 w-4" />
                      <span>复制</span>
                    </Button>
                    <Button type="button" variant="destructive" onClick={removeShortLink}>
                      <Trash2 className="h-4 w-4" />
                      <span>删除</span>
                    </Button>
                    <Button type="button" onClick={updateShortLink}>
                      <RefreshCw className="h-4 w-4" />
                      <span>更新短链接</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </EditorSection>
          <div className="py-10"></div>
        </div>
      </div>

      <PreviewDialog
        open={previewOpen}
        loading={previewLoading}
        preview={preview}
        stats={stats}
        warnings={warnings}
        previewError={previewError}
        subscriptionInfo={subscriptionInfo}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
