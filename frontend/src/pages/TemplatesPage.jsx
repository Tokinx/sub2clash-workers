import { useMemo, useState } from "react";

import { Button } from "../components/Button.jsx";
import SectionCard from "../components/SectionCard.jsx";
import { Input, Select, Textarea } from "../components/Fields.jsx";
import { apiFetch } from "../lib/api.js";

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
  const [preview, setPreview] = useState("");

  const allTemplates = useMemo(() => [...templates.builtin, ...templates.custom], [templates]);

  function loadTemplate(template) {
    if (template.builtin) {
      setDraft({
        id: template.id,
        name: template.name,
        target: template.target,
        content: "内置模板内容由静态资源提供，不能直接编辑。",
      });
      setPreview("");
      return;
    }
    setDraft(template);
    setPreview(template.content);
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
    await apiFetch(`/api/templates/${id}`, {
      method: "DELETE",
      body: JSON.stringify({}),
    });
    setDraft(createEmptyTemplate());
    setMessage("模板已删除");
    await refreshTemplates();
  }

  async function duplicateTemplate(id) {
    await apiFetch("/api/templates", {
      method: "POST",
      body: JSON.stringify({
        action: "duplicate",
        id,
      }),
    });
    setMessage("模板已复制");
    await refreshTemplates();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <SectionCard kicker="Library" title="模板目录" description="内置模板只读，自建模板可以编辑、复制和删除。">
        <div className="space-y-3">
          {allTemplates.map((template) => (
            <article
              key={template.id}
              className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--ivory)] p-4"
            >
              <button type="button" className="w-full text-left" onClick={() => loadTemplate(template)}>
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--stone)]">
                  {template.builtin ? "Builtin" : "Custom"}
                </p>
                <h3 className="mt-2 font-display text-2xl">{template.name}</h3>
                <p className="mt-1 text-sm text-[var(--muted)]">{template.target}</p>
              </button>
              {!template.builtin ? (
                <div className="mt-4 flex gap-3">
                  <Button
                    variant="secondary"
                    onClick={() => duplicateTemplate(template.id)}
                    className="rounded-full px-4 text-sm"
                  >
                    复制
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => deleteTemplate(template.id)}
                    className="rounded-full px-4 text-sm"
                  >
                    删除
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        kicker="Editor"
        title="模板编辑器"
        description="针对自建模板，你可以直接维护 YAML。建议保留 `proxies`、`proxy-groups` 和 `rules` 三个入口。"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="模板名称"
            value={draft.name}
            onChange={(value) => setDraft((current) => ({ ...current, name: value }))}
            placeholder="例如：流媒体优先模板"
          />
          <Select
            label="目标类型"
            value={draft.target}
            onChange={(value) => setDraft((current) => ({ ...current, target: value }))}
            options={[
              { value: "meta", label: "Clash.Meta" },
              { value: "clash", label: "Clash" },
            ]}
          />
        </div>
        <Textarea
          className="mt-5"
          label="模板 YAML"
          value={draft.content}
          onChange={(value) => {
            setDraft((current) => ({ ...current, content: value }));
            setPreview(value);
          }}
          rows={18}
        />
        {message ? <p className="mt-4 text-sm text-[var(--muted)]">{message}</p> : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => setDraft(createEmptyTemplate())}
            className="rounded-full px-4 text-sm"
          >
            新建空模板
          </Button>
          <Button variant="primary" onClick={saveTemplate} className="rounded-full px-4 text-sm">
            保存模板
          </Button>
        </div>
        <div className="mt-6 rounded-[1.25rem] border border-[var(--border)] bg-[var(--ivory)] p-4">
          <p className="text-xs uppercase tracking-[0.16em] text-[var(--stone)]">实时预览</p>
          <pre className="mt-3 max-h-[24rem] overflow-auto text-xs leading-6 text-[var(--muted)]">
            {preview || "在这里查看 YAML 预览"}
          </pre>
        </div>
      </SectionCard>
    </div>
  );
}
