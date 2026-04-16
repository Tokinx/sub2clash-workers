import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import Shell from "@/components/Shell.jsx";
import { apiFetch } from "@/lib/api.js";
import { renderWithRouter } from "@/test/render.jsx";

vi.mock("@/lib/api.js", () => ({
  apiFetch: vi.fn()
}));

describe("Shell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("能显示当前激活导航并执行退出", async () => {
    const user = userEvent.setup();

    apiFetch.mockResolvedValueOnce({});

    renderWithRouter(
      <Shell>
        <div>模板页内容</div>
      </Shell>,
      { route: "/templates" }
    );

    expect(screen.getByRole("link", { name: /模板管理/i })).toHaveAttribute("aria-current", "page");

    await user.click(screen.getByRole("button", { name: /退出/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/auth/logout",
        expect.objectContaining({ method: "POST", body: JSON.stringify({}) })
      );
    });
  });
});
