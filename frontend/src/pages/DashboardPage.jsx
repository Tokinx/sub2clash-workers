import { useEffect, useMemo, useState } from "react";

import { Button } from "../components/Button.jsx";
import { Autocomplete, Input, Select, Textarea, Toggle } from "../components/Fields.jsx";
import PreviewDialog from "../components/dashboard/PreviewDialog.jsx";
import { apiFetch } from "../lib/api.js";
import { createEmptyConfig, decodeConfigPayload, encodeConfigPayload } from "../lib/config.js";
import { cn } from "../lib/cn.js";

const LONG_LINK_SOFT_LIMIT = 15_500;
const RULE_PROVIDER_BEHAVIOR_OPTIONS = [
  { value: "classical", label: "classical" },
  { value: "domain", label: "domain" },
  { value: "ipcidr", label: "ipcidr" },
];

function createEmptyReplacement() {
  return { pattern: "", replacement: "" };
}

function createEmptyRuleProvider() {
  return { name: "", group: "", behavior: "", url: "", prepend: false };
}

function createEmptyRule() {
  return { value: "", prepend: false };
}

function createEmptySubscription() {
  return { url: "", prefix: "" };
}

function ensureTableRow(items, createItem) {
  return items.length ? items : [createItem()];
}

function cleanSubscriptions(items) {
  return items.filter((item) => item.url.trim());
}

function normalizeNodes(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="M8 3.25v9.5M3.25 8h9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M3.5 4.25h9M6.25 2.75h3.5M5 4.25v7m3-7v7m3-7v7M4.25 4.25l.4 8.12c.03.66.58 1.18 1.24 1.18h4.22c.66 0 1.21-.52 1.24-1.18l.4-8.12"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4S1.5 8 1.5 8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M6.25 9.75 4.5 11.5a2.47 2.47 0 1 1-3.5-3.5L2.75 6.25M9.75 6.25 11.5 4.5a2.47 2.47 0 0 1 3.5 3.5l-1.75 1.75M5.25 10.75l5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M13.25 4.5V1.75M13.25 1.75H10.5M13.25 1.75 10.4 4.6M2.75 11.5v2.75M2.75 14.25H5.5M2.75 14.25l2.85-2.85M4.2 5.15A5 5 0 0 1 13 7M3 9a5 5 0 0 0 8.8 1.85"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path
        d="M7 12.25a5.25 5.25 0 1 0 0-10.5 5.25 5.25 0 0 0 0 10.5ZM10.75 10.75 14 14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-5">
      {eyebrow ? (
        <p className="mb-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--stone)]">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-[1.55rem] leading-[1.08] md:text-[1.9rem]">{title}</h2>
      {description ? <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">{description}</p> : null}
    </div>
  );
}

function EditorSection({ eyebrow, title, description, children }) {
  return (
    <section className="pt-6">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      {children}
    </section>
  );
}

function TableTextInput({ value, onChange, placeholder, ariaLabel }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="h-[var(--control-height)] min-h-[var(--control-height)] w-full rounded-[0.72rem] border border-[var(--border)] bg-[rgba(255,255,255,0.88)] px-[0.92rem] text-[0.95rem] leading-[1.5] text-[var(--ink)] outline-none transition-[border-color,box-shadow,transform] duration-200 focus-visible:border-[rgba(201,100,66,0.55)] focus-visible:shadow-[0_0_0_3px_rgba(201,100,66,0.12)]"
    />
  );
}

function IconButton({ label, onClick, tone = "subtle", disabled = false, className = "", children }) {
  // if(children) children.className = "h-4 w-4";
  children = { ...children, props: { ...children.props, className: "h-6 w-6 flex-shrink-0" } };
  return (
    <Button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      variant={tone === "danger" ? "danger" : "subtle"}
      size="icon"
      className={className}
    >
      {children}
    </Button>
  );
}

function AddRowButton({ label, onClick, className = "" }) {
  return (
    <div className="flex justify-center">
      <Button variant="secondary" className={className} onClick={onClick}>
        <PlusIcon />
        <span>{label}</span>
      </Button>
    </div>
  );
}

function EditorTable({ columnsClassName, minWidthClassName, headers, children }) {
  return (
    <div className="rounded-[0.76rem] border border-[var(--border)] bg-[rgba(255,255,255,0.34)] px-3 py-1.5">
      <div className={cn("overflow-auto pt-1.5")}>
        <div className={`mb-1 grid ${columnsClassName}`}>
          {headers.map((header) => (
            <p
              key={header}
              className={`m-0 text-[0.72rem] uppercase text-[var(--stone)] ${header === "操作" || header === "前置" ? "text-center" : ""}`}
            >
              {header}
            </p>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

function EditorTableRow({ columnsClassName, children }) {
  return <div className={`grid items-center gap-3 py-1.5 ${columnsClassName}`}>{children}</div>;
}

function ReplacementEditor({ replacements, onChange }) {
  const columnsClassName = "grid grid-cols-[minmax(16rem,1fr)_minmax(16rem,1fr)_3rem] gap-3";
  const rows = ensureTableRow(replacements, createEmptyReplacement);
  const canDelete = rows.length > 1;

  return (
    <div className="space-y-3">
      <EditorTable
        headers={["匹配正则", "替换文本", "操作"]}
        columnsClassName={columnsClassName}
        minWidthClassName="min-w-[37rem]"
      >
        {rows.map((item, index) => (
          <EditorTableRow key={`${item.pattern}-${index}`} columnsClassName={columnsClassName}>
            <TableTextInput
              value={item.pattern}
              ariaLabel="匹配正则"
              placeholder="香港|HK"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], pattern: value };
                onChange(next);
              }}
            />
            <TableTextInput
              value={item.replacement}
              ariaLabel="替换文本"
              placeholder="Hong Kong"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], replacement: value };
                onChange(next);
              }}
            />
            <div className="flex justify-center">
              <IconButton
                label="删除替换规则"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) return;
                  onChange(rows.filter((_, itemIndex) => itemIndex !== index));
                }}
                tone="danger"
              >
                <TrashIcon />
              </IconButton>
            </div>
          </EditorTableRow>
        ))}
      </EditorTable>

      <AddRowButton label="新增规则" onClick={() => onChange([...rows, createEmptyReplacement()])} />
    </div>
  );
}

function RuleProviderEditor({ providers, onChange }) {
  const columnsClassName = "grid grid-cols-[9rem_10rem_minmax(11rem,0.8fr)_minmax(18rem,1fr)_5rem_3rem] gap-3";
  const rows = ensureTableRow(providers, createEmptyRuleProvider);
  const canDelete = rows.length > 1;

  return (
    <div className="space-y-3">
      <EditorTable
        headers={["名称", "策略组", "行为", "URL", "前置", "操作"]}
        columnsClassName={columnsClassName}
        minWidthClassName="min-w-[55rem]"
      >
        {rows.map((item, index) => (
          <EditorTableRow key={`${item.name}-${index}`} columnsClassName={columnsClassName}>
            <TableTextInput
              value={item.name}
              ariaLabel="名称"
              placeholder="streaming"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], name: value };
                onChange(next);
              }}
            />
            <TableTextInput
              value={item.group}
              ariaLabel="策略组"
              placeholder="节点选择"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], group: value };
                onChange(next);
              }}
            />
            <Autocomplete
              value={item.behavior}
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], behavior: value };
                onChange(next);
              }}
              options={RULE_PROVIDER_BEHAVIOR_OPTIONS}
              placeholder="选择或输入行为"
              ariaLabel="行为"
            />
            <TableTextInput
              value={item.url}
              ariaLabel="URL"
              placeholder="https://example.com/provider.yaml"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], url: value };
                onChange(next);
              }}
            />
            <div className="flex min-h-[2.875rem] items-center justify-center">
              <Toggle
                label="插入到规则前部"
                checked={Boolean(item.prepend)}
                compact
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...next[index], prepend: value };
                  onChange(next);
                }}
              />
            </div>
            <div className="flex justify-center">
              <IconButton
                label="删除订阅规则"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) {
                    return;
                  }
                  onChange(rows.filter((_, itemIndex) => itemIndex !== index));
                }}
                tone="danger"
              >
                <TrashIcon />
              </IconButton>
            </div>
          </EditorTableRow>
        ))}
      </EditorTable>

      <AddRowButton label="订阅规则" onClick={() => onChange([...rows, createEmptyRuleProvider()])} />
    </div>
  );
}

function RulesEditor({ rules, onChange }) {
  const columnsClassName = "grid grid-cols-[minmax(24rem,1fr)_5rem_3rem] gap-3";
  const rows = ensureTableRow(rules, createEmptyRule);
  const canDelete = rows.length > 1;

  return (
    <div className="space-y-3">
      <EditorTable
        headers={["规则", "前置", "操作"]}
        columnsClassName={columnsClassName}
        minWidthClassName="min-w-[36rem]"
      >
        {rows.map((item, index) => (
          <EditorTableRow key={`${item.value}-${index}`} columnsClassName={columnsClassName}>
            <TableTextInput
              value={item.value}
              ariaLabel="规则"
              placeholder="DOMAIN-SUFFIX,openai.com,DIRECT"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], value };
                onChange(next);
              }}
            />
            <div className="flex min-h-[2.875rem] items-center justify-center">
              <Toggle
                label="前置"
                checked={Boolean(item.prepend)}
                compact
                onChange={(value) => {
                  const next = [...rows];
                  next[index] = { ...next[index], prepend: value };
                  onChange(next);
                }}
              />
            </div>
            <div className="flex justify-center">
              <IconButton
                label="删除规则"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) {
                    return;
                  }
                  onChange(rows.filter((_, itemIndex) => itemIndex !== index));
                }}
                tone="danger"
              >
                <TrashIcon />
              </IconButton>
            </div>
          </EditorTableRow>
        ))}
      </EditorTable>

      <AddRowButton label="新增规则" onClick={() => onChange([...rows, createEmptyRule()])} />
    </div>
  );
}

function SubscriptionEditor({ subscriptions, onChange }) {
  const columnsClassName = "grid grid-cols-[minmax(24rem,1fr)_12rem_3rem] gap-3";
  const rows = ensureTableRow(subscriptions, createEmptySubscription);
  const canDelete = rows.length > 1;

  return (
    <div className="space-y-3">
      <EditorTable
        headers={["订阅地址", "节点前缀", "操作"]}
        columnsClassName={columnsClassName}
        minWidthClassName="min-w-[40rem]"
      >
        {rows.map((item, index) => (
          <EditorTableRow key={`${item.url}-${index}`} columnsClassName={columnsClassName}>
            <TableTextInput
              value={item.url}
              ariaLabel="订阅地址"
              placeholder="https://example.com/subscription"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], url: value };
                onChange(next);
              }}
            />
            <TableTextInput
              value={item.prefix}
              ariaLabel="节点前缀"
              placeholder="Subscribe A"
              onChange={(value) => {
                const next = [...rows];
                next[index] = { ...next[index], prefix: value };
                onChange(next);
              }}
            />
            <div className="flex justify-center">
              <IconButton
                label="删除订阅"
                disabled={!canDelete}
                onClick={() => {
                  if (!canDelete) {
                    return;
                  }
                  onChange(rows.filter((_, itemIndex) => itemIndex !== index));
                }}
                tone="danger"
              >
                <TrashIcon />
              </IconButton>
            </div>
          </EditorTableRow>
        ))}
      </EditorTable>

      <AddRowButton label="新增订阅" onClick={() => onChange([...rows, createEmptySubscription()])} />
    </div>
  );
}

export default function DashboardPage({ templates }) {
  const [config, setConfig] = useState(createEmptyConfig());
  const [nodesText, setNodesText] = useState("");
  const [preview, setPreview] = useState("");
  const [stats, setStats] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [pageError, setPageError] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [linkInput, setLinkInput] = useState("");
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

  const canCopyLongLink = longLink.length < LONG_LINK_SOFT_LIMIT;

  useEffect(() => {
    if (!templateOptions.length) {
      return;
    }
    const available = templateOptions.some(
      (option) => option.value === `${config.template.mode}:${config.template.value}`,
    );
    if (!available) {
      const fallback = templateOptions[0].value.split(":");
      setConfig((current) => ({
        ...current,
        template: {
          mode: fallback[0],
          value: fallback[1],
        },
      }));
    }
  }, [templateOptions]);

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
      const url = new URL(linkInput.trim());
      if (url.pathname.startsWith("/sub/")) {
        const payload = url.pathname.split("/").pop();
        const nextConfig = decodeConfigPayload(payload);
        setConfig(nextConfig);
        setNodesText((nextConfig.sources?.nodes || []).join("\n"));
        setShortLinkId("");
        setPageError("");
        return;
      }
      if (url.pathname.startsWith("/s/")) {
        const id = url.pathname.split("/").pop();
        const data = await apiFetch(`/api/links/${id}`);
        setConfig(data.config);
        setNodesText((data.config.sources?.nodes || []).join("\n"));
        setShortLinkId(data.id);
        setPageError("");
        return;
      }
      setPageError("暂不支持该链接格式。");
    } catch (error) {
      setPageError(error.message || "导入失败。");
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
      setPageError("");
    } catch (error) {
      setPageError(error.message || "生成短链接失败。");
    }
  }

  async function updateShortLink() {
    if (!shortLinkId) {
      return;
    }

    try {
      await apiFetch(`/api/links/${shortLinkId}`, {
        method: "PUT",
        body: JSON.stringify({ config: effectiveConfig }),
      });
      setPageError("");
    } catch (error) {
      setPageError(error.message || "更新短链接失败。");
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
      setShortLinkId("");
      setPageError("");
    } catch (error) {
      setPageError(error.message || "删除短链接失败。");
    }
  }

  return (
    <>
      <div className="max-w-6xl mx-auto">
        <div className="space-y-6">
          <section>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <Input
                className="min-w-0"
                label="Links"
                value={linkInput}
                onChange={setLinkInput}
                placeholder="粘贴 /sub/... 或 /s/... 链接"
              />
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={importLink}>
                  <SearchIcon />
                  <span>解析</span>
                </Button>
              </div>
            </div>

            {pageError ? (
              <p className="mt-4 rounded-[0.72rem] border border-[var(--border)] bg-[rgba(255,255,255,0.3)] px-4 py-3 text-sm text-[var(--error)]">
                {pageError}
              </p>
            ) : null}
          </section>

          <EditorSection
            eyebrow="Inputs"
            title="订阅聚合"
            description="支持多个订阅地址与单节点混合输入。订阅前缀会附加到该订阅的每个节点名上。"
          >
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

            <Textarea
              className="mt-5"
              label="单节点输入"
              value={nodesText}
              onChange={setNodesText}
              rows={7}
              placeholder={"每行一个节点分享链接，\nvmess://...\nss://..."}
            />
          </EditorSection>

          <EditorSection eyebrow="Template" title="模板与目标类型" description="模板来源仅支持内置模板与后台自建模板。">
            <div className="grid gap-4 xl:grid-cols-3">
              <Select
                label="目标"
                value={config.target}
                onChange={(value) => setConfig((current) => ({ ...current, target: value }))}
                options={[
                  { value: "meta", label: "Clash.Meta" },
                  { value: "clash", label: "Clash" },
                ]}
              />
              <Select
                label="模板"
                value={`${config.template.mode}:${config.template.value}`}
                onChange={updateTemplate}
                options={templateOptions}
              />
              <Select
                label="国家组排序"
                value={config.options.sort}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, sort: value },
                  }))
                }
                options={[
                  { value: "nameasc", label: "名称升序" },
                  { value: "namedesc", label: "名称降序" },
                  { value: "sizeasc", label: "数量升序" },
                  { value: "sizedesc", label: "数量降序" },
                ]}
              />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Toggle
                label="强制刷新订阅缓存"
                checked={Boolean(config.options.refresh)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, refresh: value },
                  }))
                }
              />
              <Toggle
                label="国家组测速"
                checked={Boolean(config.options.autoTest)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, autoTest: value },
                  }))
                }
              />
              <Toggle
                label="lazy url-test"
                checked={Boolean(config.options.lazy)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, lazy: value },
                  }))
                }
              />
              <Toggle
                label="仅输出节点列表"
                checked={Boolean(config.options.nodeList)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, nodeList: value },
                  }))
                }
              />
              <Toggle
                label="忽略国家分组"
                checked={Boolean(config.options.ignoreCountryGroup)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, ignoreCountryGroup: value },
                  }))
                }
              />
              <Toggle
                label="启用 UDP"
                checked={Boolean(config.options.useUDP)}
                onChange={(value) =>
                  setConfig((current) => ({
                    ...current,
                    options: { ...current.options, useUDP: value },
                  }))
                }
              />
            </div>
            <Input
              className="mt-5"
              label="User-Agent"
              value={config.options.userAgent}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  options: { ...current.options, userAgent: value },
                }))
              }
            />
          </EditorSection>

          <EditorSection
            eyebrow="Routing"
            title="规则"
            description="在模板之外继续扩展规则和 Rule Provider，支持前置插入。"
          >
            <div>
              <p className="mb-3 text-[0.72rem] uppercase text-[var(--stone)]">Rule Provider</p>
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
            </div>
            <div className="mt-6">
              <p className="mb-3 text-[0.72rem] uppercase text-[var(--stone)]">规则列表</p>
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
            </div>
          </EditorSection>

          <EditorSection
            eyebrow="Transforms"
            title="过滤与替换"
            description="`filterRegex` 会删除命中的节点；`replacements` 按顺序执行名称替换。"
          >
            <Input
              label="过滤"
              value={config.transforms.filterRegex}
              onChange={(value) =>
                setConfig((current) => ({
                  ...current,
                  transforms: {
                    ...current.transforms,
                    filterRegex: value,
                  },
                }))
              }
              placeholder="(过期|测试)"
            />
            <div className="mt-6">
              <p className="mb-3 text-[0.72rem] uppercase text-[var(--stone)]">替换</p>
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
            eyebrow="Share"
            title="订阅连接"
            description="长链接会直接携带整个配置；超过软限制时，建议改用短链接。"
          >
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <Input
                className="min-w-0"
                label="长链接"
                value={longLink}
                onChange={null}
                readOnly
                spellCheck={false}
                inputClassName="font-mono text-[0.84rem]"
              />
              <div className="flex flex-wrap items-center gap-3 xl:self-end">
                <Button variant="primary" className="whitespace-nowrap" onClick={createShortLink}>
                  <LinkIcon />
                  <span>生成短链接</span>
                </Button>
                <Button variant="secondary" className="whitespace-nowrap" onClick={renderCurrentConfig}>
                  <EyeIcon />
                  <span>预览 YAML</span>
                </Button>
              </div>
            </div>
            {!canCopyLongLink ? (
              <p className="mt-3 text-sm text-[var(--error)]">长链接接近 Workers URL 限制，建议生成短链接。</p>
            ) : null}

            {shortLinkId ? (
              <div className="mt-5 border-t border-[var(--border)] pt-5">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                  <Input
                    label="当前短链"
                    value={`${window.location.origin}/s/${shortLinkId}`}
                    onChange={null}
                    readOnly
                  />
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <Button variant="primary" onClick={updateShortLink}>
                      <RefreshIcon />
                      <span>更新短链</span>
                    </Button>
                    <Button variant="danger" onClick={removeShortLink}>
                      <TrashIcon />
                      <span>删除短链</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </EditorSection>
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
