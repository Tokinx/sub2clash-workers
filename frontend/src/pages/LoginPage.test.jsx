import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import LoginPage from "@/pages/LoginPage.jsx";
import { apiFetch } from "@/lib/api.js";

vi.mock("@/lib/api.js", () => ({
  apiFetch: vi.fn()
}));

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("提交密码后会调用登录接口并触发认证回调", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    apiFetch.mockResolvedValueOnce({});

    render(<LoginPage onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByPlaceholderText("Enter password"), "test-password");
    await user.click(screen.getByRole("button", { name: /Enter Dashboard/i }));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith(
        "/api/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ password: "test-password" })
        })
      );
    });
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("登录失败时会展示错误提示", async () => {
    const user = userEvent.setup();

    apiFetch.mockRejectedValueOnce(new Error("密码错误"));

    render(<LoginPage onAuthenticated={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Enter password"), "wrong");
    await user.click(screen.getByRole("button", { name: /Enter Dashboard/i }));

    expect(await screen.findByText("密码错误")).toBeInTheDocument();
  });
});
