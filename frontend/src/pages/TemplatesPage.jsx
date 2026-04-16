import { Copy, Plus, Save, Trash2, WrapText } from "lucide-react";
import { useMemo, useState } from "react";
import YAML from "yaml";

import Field from "@/components/Field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api.js";

function createEmptyTemplate() {
  return {
    id: "",
    name: "",
    target: "meta",
    content: "mixed-port: 7890\nallow-lan: true\nmode: Rule\nproxies: []\nproxy-groups: []\nrules: []\n",
  };
}

export default function TemplatesPage({ templates, refreshTemplates }) {
  const [draft, setDraft] = useState(createEmptyTemplate());
  const [message, setMessage] = useState("");

  // 监听 message 变化，在 3 秒后自动清除提示信息
  useMemo(() => {
    if (!message) return;

    const timer = setTimeout(() => {
      setMessage("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [message]);

  const allTemplates = useMemo(() => [...templates.builtin, ...templates.custom], [templates]);
  const activeTemplate = useMemo(
    () => allTemplates.find((template) => template.id === draft.id) || null,
    [allTemplates, draft.id],
  );
  const readonlyBuiltin = Boolean(activeTemplate?.builtin);

  function loadTemplate(template) {
    if (template.builtin) {
      setDraft({
        id: template.id,
        name: template.name,
        target: template.target,
        content: template.content,
      });
      if (!template.content) setMessage("内置模板内容由系统提供，不能直接编辑。");
      else setMessage("");
      return;
    }

    setDraft({ ...template });
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
    try {
      if (draft.id) {
        await apiFetch(`/api/templates/${draft.id}`, {
          method: "PUT",
          body: JSON.stringify({
            name: draft.name,
            target: draft.target,
            content: draft.content,
          }),
        });
        setMessage("模板已更新");
      } else {
        const created = await apiFetch("/api/templates", {
          method: "POST",
          body: JSON.stringify({
            name: draft.name,
            target: draft.target,
            content: draft.content,
          }),
        });
        setDraft(created);
        setMessage("模板已创建");
      }

      await refreshTemplates();
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
      setDraft(createEmptyTemplate());
      setMessage("模板已删除");
      await refreshTemplates();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function duplicateTemplate(id) {
    try {
      await apiFetch("/api/templates", {
        method: "POST",
        body: JSON.stringify({
          action: "duplicate",
          id,
        }),
      });
      setMessage("模板已复制");
      await refreshTemplates();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="py-[2%]" />

      <div className="grid gap-4 items-end sm:grid-cols-2 md:grid-cols-3">
        <Field label="模板名称">
          <Input
            value={draft.name}
            disabled={readonlyBuiltin}
            readOnly={readonlyBuiltin}
            placeholder="例如：流媒体优先模板"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
        </Field>

        <Field label="目标类型">
          <Select
            value={draft.target}
            disabled={readonlyBuiltin}
            onValueChange={(value) => setDraft((current) => ({ ...current, target: value }))}
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

        <div className="ml-auto flex flex-wrap gap-3 sm:col-span-2 md:col-span-1">
          <Button
            type="button"
            variant="secondary"
            className="px-4"
            aria-label="格式化模板"
            disabled={readonlyBuiltin}
            onClick={formatTemplate}
          >
            <WrapText className="h-4 w-4" />
            <span>格式化</span>
          </Button>
          <Button
            type="button"
            className="px-4"
            aria-label="保存模板"
            disabled={readonlyBuiltin}
            onClick={saveTemplate}
          >
            <Save className="h-4 w-4" />
            <span>保存</span>
          </Button>
        </div>
      </div>

      <ScrollArea className="my-4 mb-2 w-full whitespace-nowrap">
        <div className="flex w-max gap-3 pb-2 pr-3">
          {allTemplates.map((template) => (
            <Card
              key={template.id}
              className={`w-50 flex-shrink-0 shadow-none relative ${draft.id === template.id ? "border-[rgba(201,100,66,0.4)] bg-[rgba(201,100,66,0.06)]" : "border-border bg-[rgba(255,255,255,0.82)]"}`}
            >
              <CardContent className="p-3!">
                <button type="button" className="p-0 w-full text-left" onClick={() => loadTemplate(template)}>
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--stone)]">
                    {template.builtin ? "System" : "Custom"}
                  </p>
                  <h3 className="mt-2 font-display text-md leading-[1.08]">{template.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground capitalize">{template.target}</p>
                </button>

                {!template.builtin ? (
                  <div className="absolute top-2 right-2 flex flex-wrap gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label="复制"
                      className="w-6 h-6 p-0 bg-transparent"
                      onClick={() => duplicateTemplate(template.id)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      aria-label="删除"
                      className="w-6 h-6 p-0 bg-transparent"
                      onClick={() => deleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
          <Button
            type="button"
            variant="secondary"
            aria-label="新建模板"
            className="w-50 flex-shrink-0 px-4 h-[unset]!"
            onClick={() => {
              setDraft(createEmptyTemplate());
              setMessage("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <div className="relative">
        <Textarea
          rows={20}
          aria-label="模板内容"
          value={draft.content}
          readOnly={readonlyBuiltin}
          onChange={(event) => {
            setDraft((current) => ({ ...current, content: event.target.value }));
          }}
        />
        {message ? (
          <Alert className="absolute bottom-2 left-2 right-2 w-auto text-sm bg-primary/5 border-primary/30 text-primary">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <div className="py-[2%]" />
    </div>
  );
}
