import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import TemplatesPage from "@/pages/TemplatesPage.jsx";
import { apiFetch } from "@/lib/api.js";
import { renderWithRouter } from "@/test/render.jsx";

vi.mock("@/lib/api.js", () => ({
  apiFetch: vi.fn()
}));

const templates = {
  builtin: [{ id: "meta-default", name: "内置模板", target: "meta", builtin: true }],
  custom: [
    {
      id: "custom-1",
      name: "自建模板",
      target: "meta",
      builtin: false,
      content: "proxies: []\nproxy-groups: []\nrules: []\n"
    }
  ]
};

describe("TemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("选择内置模板时会进入只读状态且不显示额外提示", async () => {
    const user = userEvent.setup();

    renderWithRouter(<TemplatesPage templates={templates} refreshTemplates={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /内置模板/i }));

    expect(screen.getByDisplayValue("内置模板")).toBeDisabled();
    expect(screen.getByRole("button", { name: /保存模板/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /格式化模板/i })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: /模板内容/i })).toHaveValue("内置模板内容由系统提供，不能直接编辑。");
    expect(screen.queryByText(/当前选择的是内置模板/)).not.toBeInTheDocument();
  });

  it("可以格式化、保存、复制并删除自建模板", async () => {
    const user = userEvent.setup();
    const refreshTemplates = vi.fn();

    apiFetch
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    renderWithRouter(<TemplatesPage templates={templates} refreshTemplates={refreshTemplates} />);

    await user.click(screen.getByRole("button", { name: /自建模板/i }));

    const nameInput = screen.getByDisplayValue("自建模板");
    const editor = screen.getByRole("textbox", { name: /模板内容/i });

    await user.clear(editor);
    await user.click(editor);
    await user.paste("proxy-groups: [{name: 节点选择, type: select, proxies: [DIRECT]}]\nrules: [MATCH, DIRECT]\nproxies: []");
    await user.click(screen.getByRole("button", { name: /格式化模板/i }));

    expect(editor).toHaveValue(
      "proxy-groups:\n  - name: 节点选择\n    type: select\n    proxies:\n      - DIRECT\nrules:\n  - MATCH\n  - DIRECT\nproxies: []\n",
    );

    await user.clear(nameInput);
    await user.type(nameInput, "我的模板");
    await user.click(screen.getByRole("button", { name: /保存模板/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(
        1,
        "/api/templates/custom-1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "我的模板",
            target: "meta",
            content:
              "proxy-groups:\n  - name: 节点选择\n    type: select\n    proxies:\n      - DIRECT\nrules:\n  - MATCH\n  - DIRECT\nproxies: []\n"
          })
        })
      );
    });

    await user.click(screen.getByRole("button", { name: "复制" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/templates",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          action: "duplicate",
          id: "custom-1"
        })
      })
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      "/api/templates/custom-1",
      expect.objectContaining({ method: "DELETE", body: JSON.stringify({}) })
    );
    expect(refreshTemplates).toHaveBeenCalledTimes(3);
  });
});
