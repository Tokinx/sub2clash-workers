import { Link, NavLink, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api.js";
import { cn } from "@/lib/utils";

function navLinkClassName(isActive) {
  return cn(
    "inline-flex h-8 items-center px-4 text-sm transition",
    isActive
      ? "bg-[var(--sand)]/50 text-primary hover:bg-[var(--sand)]/80"
      : "text-muted-foreground  hover:text-primary/80",
  );
}

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

      <header className="sticky top-0 z-20 px-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between py-4">
          <Link to="/" className="font-display text-lg font-bold leading-[0.88] text-[var(--brand)]">
            Sub2Clash
            <br />
            <span className="text-xs font-normal">on Cloudflare Workers</span>
          </Link>

          <nav className="flex items-center gap-2 text-sm">
            <NavLink to="/" className={({ isActive }) => navLinkClassName(isActive)}>
              配置
            </NavLink>
            <NavLink to="/templates" className={({ isActive }) => navLinkClassName(isActive)}>
              模板
            </NavLink>
            <Button variant="default" size="sm" className="h-8! rounded-none px-4 text-sm" onClick={handleLogout}>
              退出
            </Button>
          </nav>
        </div>
      </header>

      <main className="relative px-4 md:px-6">{children}</main>

      <footer className="border-t border-amber-800/5! px-4 py-6 md:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="font-display text-sm text-muted-foreground">
            © {new Date().getFullYear()} . Build with love on Cloudflare Workers
          </p>
        </div>
      </footer>
    </div>
  );
}
