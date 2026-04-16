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

  it("可以解析链接、生成短链并复制短链", async () => {
    const user = userEvent.setup();
    const config = createEmptyConfig();
    config.sources.nodes = ["vmess://node-a"];
    const longLink = `https://app.example.com/sub/${encodeConfigPayload(config)}`;

    apiFetch.mockResolvedValueOnce({ id: "short-link-id" });

    render(<DashboardPage templates={templates} />);

    fireEvent.change(screen.getByPlaceholderText("粘贴 /sub/... 或 /s/... 链接"), {
      target: { value: longLink }
    });
    await user.click(screen.getByRole("button", { name: /解析/i }));

    expect(await screen.findByDisplayValue("vmess://node-a")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /生成短链接/i }));

    expect(await screen.findByRole("button", { name: /复制短链接/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /复制短链接/i }));
    expect(await screen.findByText("短链接已复制")).toBeInTheDocument();
  });

  it("支持规则编辑、Behavior 选择和 YAML 预览", async () => {
    const user = userEvent.setup();

    apiFetch.mockResolvedValueOnce({
      yaml: "proxies: []\n",
      stats: {
        proxyCount: 0,
        countryGroupCount: 0,
        templateId: "meta-default"
      },
      warnings: ["示例告警"],
      subscriptionUserinfo: "upload=1; download=2"
    });

    render(<DashboardPage templates={templates} />);

    await user.click(screen.getByRole("button", { name: /新增规则/i }));
    expect(screen.getAllByLabelText("规则")).toHaveLength(2);

    const behaviorInput = screen.getByLabelText("行为");
    await user.click(behaviorInput);
    await user.type(behaviorInput, "dom");
    await user.click(await screen.findByText("domain"));
    expect(behaviorInput).toHaveValue("domain");

    await user.click(screen.getByRole("button", { name: /预览 YAML/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/render",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(await screen.findByText("输出预览")).toBeInTheDocument();
    expect(screen.getByText("proxies: []", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("示例告警")).toBeInTheDocument();
  });
});
