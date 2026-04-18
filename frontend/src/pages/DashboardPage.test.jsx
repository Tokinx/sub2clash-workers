import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import DashboardPage from "@/pages/DashboardPage.jsx";
import { apiFetch } from "@/lib/api.js";
import { createEmptyConfig, encodeConfigPayload } from "@/lib/config.js";

vi.mock("@/lib/api.js", () => ({
  apiFetch: vi.fn()
}));

const templates = {
  builtin: [{ id: "meta-default", name: "默认模板", target: "meta", builtin: true }],
  custom: []
};

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue()
      }
    });
  });

  it("支持短链自动补全、自定义输入解析与短链复制", async () => {
    const user = userEvent.setup();
    const importedShortConfig = createEmptyConfig();
    importedShortConfig.sources.nodes = ["vmess://node-from-short"];
    importedShortConfig.override.content = "mixed-port!: 7892\n";
    const longLinkConfig = createEmptyConfig();
    longLinkConfig.sources.nodes = ["vmess://node-from-long"];
    longLinkConfig.override.content = "mixed-port!: 7891\n";
    const longLink = `https://app.example.com/sub/${encodeConfigPayload(longLinkConfig)}`;

    apiFetch
      .mockResolvedValueOnce({
        links: [
          {
            id: "saved-link-id",
            createdAt: "2026-04-16T01:00:00.000Z",
            updatedAt: "2026-04-16T02:00:00.000Z"
          },
          {
            id: "saved-link-id-2",
            createdAt: "2026-04-16T00:00:00.000Z",
            updatedAt: "2026-04-16T01:30:00.000Z"
          }
        ]
      })
      .mockResolvedValueOnce({
        id: "saved-link-id",
        config: importedShortConfig
      })
      .mockResolvedValueOnce({
        id: "short-link-id",
        createdAt: "2026-04-16T03:00:00.000Z",
        updatedAt: "2026-04-16T03:00:00.000Z"
      });

    render(<DashboardPage templates={templates} />);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    const linkInput = screen.getByRole("textbox", { name: /导入链接/i });
    await user.click(linkInput);
    expect(linkInput).toHaveFocus();
    const firstHistoryOption = await screen.findByText("/s/saved-link-id");
    expect(firstHistoryOption).toBeInTheDocument();
    expect(screen.getByText("/s/saved-link-id-2")).toBeInTheDocument();
    await user.click(await screen.findByText("/s/saved-link-id"));
    expect(linkInput).toHaveValue("/s/saved-link-id");

    await user.click(linkInput);
    expect(linkInput).toHaveFocus();
    expect(await screen.findByText("/s/saved-link-id")).toBeInTheDocument();
    expect(screen.getByText("/s/saved-link-id-2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /解析/i }));

    expect(await screen.findByDisplayValue("vmess://node-from-short")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /覆写内容/i })).toHaveValue("mixed-port!: 7892\n");

    fireEvent.change(linkInput, {
      target: { value: longLink }
    });
    expect(await screen.findByText("/s/saved-link-id")).toBeInTheDocument();
    expect(screen.getByText("/s/saved-link-id-2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /解析/i }));

    expect(await screen.findByDisplayValue("vmess://node-from-long")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /覆写内容/i })).toHaveValue("mixed-port!: 7891\n");

    await user.click(screen.getByRole("button", { name: /生成短链接/i }));

    expect(await screen.findByRole("button", { name: /复制短链接/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /复制短链接/i }));
    expect(await screen.findByText("短链接已复制")).toBeInTheDocument();
  });

  it("支持规则编辑、Behavior 选择和 YAML 预览", async () => {
    const user = userEvent.setup();

    apiFetch
      .mockResolvedValueOnce({ links: [] })
      .mockResolvedValueOnce({
        yaml: "proxies: []\n",
        stats: {
          proxyCount: 0,
          countryGroupCount: 0,
          templateId: "meta-default"
        },
        warnings: ["仅输出节点列表时已忽略覆写"],
        subscriptionUserinfo: "upload=1; download=2"
      });

    render(<DashboardPage templates={templates} />);
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole("button", { name: /新增规则/i }));
    expect(screen.getAllByLabelText("规则")).toHaveLength(2);

    const behaviorInput = screen.getByLabelText("行为");
    await user.click(behaviorInput);
    expect((await screen.findByText("classical")).closest("[cmdk-item]")).toHaveAttribute("aria-selected", "false");
    await user.type(behaviorInput, "dom");
    await user.click(await screen.findByText("domain"));
    expect(behaviorInput).toHaveValue("domain");

    const overrideInput = screen.getByRole("textbox", { name: /覆写内容/i });
    fireEvent.change(overrideInput, {
      target: { value: "rules: [MATCH, DIRECT]" }
    });
    await user.click(screen.getByRole("button", { name: /格式化覆写 YAML/i }));
    expect(overrideInput).toHaveValue("rules:\n  - MATCH\n  - DIRECT\n");

    await user.click(screen.getByRole("switch", { name: /仅输出节点列表/i }));

    await user.click(screen.getByRole("button", { name: /预览 YAML/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/render",
        expect.objectContaining({ method: "POST" })
      );
    });

    const renderPayload = JSON.parse(apiFetch.mock.calls[1][1].body);
    expect(renderPayload.override).toEqual({
      type: "yaml",
      content: "rules:\n  - MATCH\n  - DIRECT\n"
    });
    expect(renderPayload.options.nodeList).toBe(true);

    expect(await screen.findByText("输出预览")).toBeInTheDocument();
    expect(screen.getByText("proxies: []", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("仅输出节点列表时已忽略覆写")).toBeInTheDocument();
  });
});
