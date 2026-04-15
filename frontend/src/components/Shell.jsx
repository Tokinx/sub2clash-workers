import { Link, NavLink, useNavigate } from "react-router-dom";

import { Button } from "./Button.jsx";
import { apiFetch } from "../lib/api.js";

export default function Shell({ children }) {
  const navigate = useNavigate();

  async function handleLogout() {
    await apiFetch("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({}),
    });
    navigate("/");
    window.location.reload();
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,100,66,0.16),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(20,20,19,0.08),transparent_30%)]" />
      <header className="sticky top-0 z-20 backdrop-blur-md px-3">
        <div className="flex items-center justify-between py-4 max-w-6xl mx-auto">
          <Link to="/" className="font-display text-lg font-bold leading-[0.88] text-[var(--brand)]">
            Sub2Clash
            <br />
            <span className="text-xs font-normal">on Cloudflare Workers</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `text-md! rounded-2xl! px-4 h-8! flex items-center ${isActive ? "bg-[var(--sand)] text-[var(--ink)] shadow-[0_0_0_1px_var(--ring)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`
              }
            >
              配置器
            </NavLink>
            <NavLink
              to="/templates"
              className={({ isActive }) =>
                `text-md! rounded-2xl! px-4 h-8! flex items-center ${isActive ? "bg-[var(--sand)] text-[var(--ink)] shadow-[0_0_0_1px_var(--ring)]" : "text-[var(--muted)] hover:text-[var(--ink)]"}`
              }
            >
              模板管理
            </NavLink>
            <Button variant="primary" onClick={handleLogout} className="text-md! rounded-2xl! px-4 h-8!">
              退出
            </Button>
          </nav>
        </div>
      </header>
      <main className="relative px-4 py-4 md:px-6 md:py-6">{children}</main>

      <footer className="border-t border-amber-600/10 px-4 py-6 md:px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-sm text-[var(--muted)]">© {new Date().getFullYear()} . Build with ❤️</p>
        </div>
      </footer>
    </div>
  );
}
