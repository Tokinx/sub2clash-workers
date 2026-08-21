import { Copy, Plus, RotateCcw, Save, Trash2, WrapText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import YAML from "yaml";

import Field from "@/components/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api.js";
import { cn } from "@/lib/utils";

function createEmptyTemplate() {
  return {
    id: "",
    name: "",
    target: "meta",
    content: "mixed-port: 7890\nallow-lan: true\nmode: Rule\nproxies: []\nproxy-groups: []\nrules: []\n",
    builtin: false,
    isModified: false,
  };
}

export default function TemplatesPage({ templates, refreshTemplates }) {
  const [draft, setDraft] = useState(createEmptyTemplate());
  const [message, setMessage] = useState("");

  const allTemplates = useMemo(() => [...(templates?.builtin || []), ...(templates?.custom || [])], [templates]);

  // 首次载入或 draft 为空时，若有可用模板自动选中首个模板
  useEffect(() => {
    if (!draft.id && allTemplates.length > 0) {
      setDraft({ ...allTemplates[0] });
    } else if (draft.id) {
      const matched = allTemplates.find((item) => item.id === draft.id);
      if (matched) {
        setDraft((current) => ({
          ...current,
          builtin: Boolean(matched.builtin),
          isModified: Boolean(matched.isModified),
        }));
      }
    }
  }, [allTemplates]);

  // 提示信息 3 秒后自动清除
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);
    return () => clearTimeout(timer);
  }, [message]);

  const activeTemplate = useMemo(
    () => allTemplates.find((template) => template.id === draft.id) || null,
    [allTemplates, draft.id],
  );
  const isBuiltin = Boolean(draft.builtin || activeTemplate?.builtin);
  const isModified = Boolean(draft.isModified || activeTemplate?.isModified);

  const linesCount = useMemo(() => {
    if (!draft.content) return 0;
    return draft.content.split("\n").length;
  }, [draft.content]);

  const byteSizeText = useMemo(() => {
    if (!draft.content) return "0 B";
    const bytes = new TextEncoder().encode(draft.content).length;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  }, [draft.content]);

  const yamlValidation = useMemo(() => {
    if (!draft.content || !draft.content.trim()) {
      return { valid: true, error: "" };
    }
    try {
      YAML.parse(draft.content);
      return { valid: true, error: "" };
    } catch (err) {
      return { valid: false, error: err.message ? err.message.split("\n")[0] : "语法错误" };
    }
  }, [draft.content]);

  function loadTemplate(template) {
    setDraft({
      id: template.id || "",
      name: template.name || "",
      target: template.target || "meta",
      content: template.content || "",
      builtin: Boolean(template.builtin),
      isModified: Boolean(template.isModified),
    });
    setMessage("");
  }

  function formatTemplate() {
    if (!draft.content.trim()) {
      setMessage("模板内容为空，无需格式化");
      return;
    }

    try {
      const formattedContent = YAML.stringify(YAML.parse(draft.content));
      setDraft((current) => ({ ...current, content: formattedContent }));
      setMessage("模板内容已格式化");
    } catch (error) {
      setMessage(error.message || "模板内容格式错误，无法格式化");
    }
  }

  async function saveTemplate() {
    if (!draft.name?.trim()) {
      setMessage("模板名称不能为空");
      return;
    }

    try {
      if (draft.id) {
        const updated = await apiFetch(`/api/templates/${draft.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: draft.name,
            target: draft.target,
            content: draft.content,
          }),
        });
        await refreshTemplates();
        setDraft((current) => ({
          ...current,
          ...updated,
        }));
        setMessage("模板已保存");
      } else {
        const created = await apiFetch("/api/templates", {
          method: "POST",
          body: JSON.stringify({
            name: draft.name,
            target: draft.target,
            content: draft.content,
          }),
        });
        await refreshTemplates();
        setDraft(created);
        setMessage("模板已创建");
      }
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function resetTemplate(id) {
    try {
      const res = await apiFetch(`/api/templates/${id}/reset`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshTemplates();
      setDraft({ ...res });
      setMessage("已恢复为默认配置");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteTemplate(id) {
    try {
      await apiFetch(`/api/templates/${id}`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      await refreshTemplates();
      if (draft.id === id) {
        const fallback = templates.builtin?.[0] || createEmptyTemplate();
        setDraft({ ...fallback });
      }
      setMessage("模板已删除");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function duplicateTemplate(id) {
    try {
      const created = await apiFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          action: "duplicate",
          id,
        }),
      });
      await refreshTemplates();
      setDraft(created);
      setMessage("模板已复制");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto py-3 md:py-5">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* 左侧：模板导航与选择栏 */}
        <div className="lg:col-span-3 space-y-4 mt-1.5">
          {/* 系统预设分组 */}
          <div className="space-y-2">
            <div className="px-1 text-xs font-medium uppercase tracking-[0.14em] text-[var(--stone)]">
              系统预设 (Built-in)
            </div>
            <div className="space-y-2">
              {templates.builtin?.map((template) => {
                const isSelected = draft.id === template.id;
                return (
                  <div
                    key={template.id}
                    className={cn(
                      "group relative p-3 transition-all cursor-pointer bg-white/40",
                      isSelected && "bg-white",
                    )}
                    onClick={() => loadTemplate(template)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left p-0 bg-transparent border-0"
                        onClick={() => loadTemplate(template)}
                      >
                        <h4 className="font-display font-medium text-base truncate">{template.name}</h4>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="uppercase font-mono px-1.5 py-0.5 bg-[var(--sand)] text-[var(--charcoal)] text-[10px]">
                            {template.target}
                          </span>
                          {template.isModified ? (
                            <span className="px-1.5 py-0.5 bg-[rgba(201,100,66,0.12)] text-[var(--terracotta)] text-[10px] font-medium">
                              已自定义
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 bg-[var(--sand)] text-muted-foreground text-[10px]">
                              默认
                            </span>
                          )}
                        </div>
                      </button>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="复制副本"
                          aria-label="复制"
                          className="h-7 w-7 p-0 hover:bg-[rgba(201,100,66,0.1)] hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateTemplate(template.id);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 自建模板分组 */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--stone)]">
                自建模板 (Custom)
              </span>
              <span className="text-xs text-muted-foreground font-mono">{templates.custom?.length || 0}</span>
            </div>

            <div className="space-y-2">
              {templates.custom?.map((template) => {
                const isSelected = draft.id === template.id;
                return (
                  <div
                    key={template.id}
                    className={cn(
                      "group relative p-3 transition-all cursor-pointer bg-white/40",
                      isSelected && "bg-white",
                    )}
                    onClick={() => loadTemplate(template)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left p-0 bg-transparent border-0"
                        onClick={() => loadTemplate(template)}
                      >
                        <h4 className="font-display font-medium text-base truncate">{template.name}</h4>
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="uppercase font-mono px-1.5 py-0.5 bg-[var(--sand)] text-[var(--charcoal)] text-[10px]">
                            {template.target}
                          </span>
                          <span className="text-[11px] text-muted-foreground">自建</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="复制副本"
                          aria-label="复制"
                          className="h-7 w-7 p-0 hover:bg-[rgba(201,100,66,0.1)] hover:text-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateTemplate(template.id);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          title="删除模板"
                          aria-label="删除"
                          className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteTemplate(template.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 新建空白模板按钮移动至自建模板下方 */}
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 border-dashed border-[rgba(201,100,66,0.4)] text-primary hover:bg-[rgba(201,100,66,0.06)] h-10 mt-2"
              aria-label="新建模板"
              onClick={() => {
                setDraft(createEmptyTemplate());
                setMessage("已新建空白模板");
              }}
            >
              <Plus className="h-4 w-4" />
              <span>新建空白模板</span>
            </Button>
          </div>
        </div>

        {/* 右侧：主编辑区 */}
        <div className="lg:col-span-9 space-y-3">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <Field label="模板名称">
                <Input
                  value={draft.name ?? ""}
                  placeholder="例如：流媒体优先模板"
                  onChange={(e) => setDraft((c) => ({ ...c, name: e.target.value }))}
                />
              </Field>

              <Field label="目标类型">
                <Select
                  value={draft.target || "meta"}
                  onValueChange={(val) => setDraft((c) => ({ ...c, target: val }))}
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
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60">
              <div className="flex items-center gap-2">
                {isBuiltin ? (
                  <span className="text-xs px-2 py-1 bg-[var(--sand)] text-[var(--charcoal)] font-medium">
                    系统预设{isModified ? "（已自定义）" : "（默认）"}
                  </span>
                ) : draft.id ? (
                  <span className="text-xs px-2 py-1 bg-[var(--sand)] text-muted-foreground">自建模板</span>
                ) : (
                  <span className="text-xs px-2 py-1 bg-primary/10 text-primary font-medium">新建草稿（未保存）</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 ml-auto">
                {isBuiltin && isModified ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    aria-label="恢复默认"
                    onClick={() => resetTemplate(draft.id)}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>恢复默认值</span>
                  </Button>
                ) : null}

                <Button type="button" variant="secondary" size="sm" aria-label="格式化模板" onClick={formatTemplate}>
                  <WrapText className="h-3.5 w-3.5" />
                  <span>格式化</span>
                </Button>

                <Button type="button" size="sm" aria-label="保存模板" onClick={saveTemplate}>
                  <Save className="h-3.5 w-3.5" />
                  <span>保存模板</span>
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.92)]">
            <Textarea
              rows={22}
              aria-label="模板内容"
              className="font-mono text-[0.88rem] leading-6 border-0 shadow-none focus-visible:ring-0 resize-y p-4 bg-transparent"
              value={draft.content}
              onChange={(event) => {
                setDraft((current) => ({ ...current, content: event.target.value }));
              }}
            />

            {/* 底部状态栏 */}
            <div className="flex flex-wrap items-center justify-between border-t border-border/80 bg-[var(--sand)]/40 px-3.5 py-2 text-xs text-muted-foreground font-mono">
              <div className="flex items-center gap-4">
                <span>{linesCount} 行</span>
                <span>{byteSizeText}</span>
                <span className={yamlValidation.valid ? "text-emerald-700 font-sans" : "text-destructive font-sans"}>
                  {yamlValidation.valid ? "✓ YAML 语法正常" : `✕ ${yamlValidation.error}`}
                </span>
              </div>

              <div>{message ? <span className="font-sans font-medium text-primary">{message}</span> : null}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
