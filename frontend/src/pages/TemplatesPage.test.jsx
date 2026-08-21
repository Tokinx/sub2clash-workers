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
  builtin: [
    {
      id: "meta-default",
      name: "内置模板",
      target: "meta",
      builtin: true,
      isModified: false,
      content: "proxies: []\nproxy-groups: []\nrules: []\n"
    },
    {
      id: "clash-default",
      name: "Clash 内置",
      target: "clash",
      builtin: true,
      isModified: true,
      content: "proxies: []\n"
    }
  ],
  custom: [
    {
      id: "custom-1",
      name: "自建模板",
      target: "meta",
      builtin: false,
      isModified: false,
      content: "proxies: []\nproxy-groups: []\nrules: []\n"
    }
  ]
};

describe("TemplatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("内置模板开放编辑并支持保存与恢复默认", async () => {
    const user = userEvent.setup();
    const refreshTemplates = vi.fn();

    apiFetch
      .mockResolvedValueOnce({
        id: "meta-default",
        name: "内置模板修改版",
        target: "meta",
        content: "proxies: []\n",
        builtin: true,
        isModified: true
      })
      .mockResolvedValueOnce({
        id: "clash-default",
        name: "Clash 内置",
        target: "clash",
        builtin: true,
        isModified: false,
        content: "mixed-port: 7890\n"
      });

    renderWithRouter(<TemplatesPage templates={templates} refreshTemplates={refreshTemplates} />);

    // 选择 meta-default 内置模板
    await user.click(screen.getByRole("button", { name: /内置模板/i }));

    const nameInput = screen.getByDisplayValue("内置模板");
    const editor = screen.getByRole("textbox", { name: /模板内容/i });

    expect(nameInput).not.toBeDisabled();
    expect(editor).not.toHaveAttribute("readonly");

    await user.clear(nameInput);
    await user.type(nameInput, "内置模板修改版");
    await user.click(screen.getByRole("button", { name: /保存模板/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(
        1,
        "/api/templates/meta-default",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "内置模板修改版",
            target: "meta",
            content: "proxies: []\nproxy-groups: []\nrules: []\n"
          })
        })
      );
    });

    // 切换到已修改的 clash-default 内置模板
    await user.click(screen.getByRole("button", { name: /Clash 内置/i }));
    const resetButton = screen.getByRole("button", { name: /恢复默认/i });
    expect(resetButton).toBeInTheDocument();

    await user.click(resetButton);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenNthCalledWith(
        2,
        "/api/templates/clash-default/reset",
        expect.objectContaining({
          method: "POST"
        })
      );
    });
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

    const copyButtons = screen.getAllByRole("button", { name: "复制" });
    await user.click(copyButtons[copyButtons.length - 1]);

    const deleteButtons = screen.getAllByRole("button", { name: "删除" });
    await user.click(deleteButtons[0]);

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
