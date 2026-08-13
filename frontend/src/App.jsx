import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Shell from "./components/Shell.jsx";
import { useSession } from "./hooks/useSession.js";
import { apiFetch } from "./lib/api.js";

// 页面级代码分割：登录页与编辑器按需加载，首屏不背负 dashboard 重依赖（cmdk/radix）
const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const DashboardPage = lazy(() => import("./pages/DashboardPage.jsx"));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage.jsx"));

function PageFallback() {
  return (
    <div className="fixed inset-0 z-9 flex min-h-screen items-center justify-center bg-[var(--paper)] text-muted-foreground">
      正在加载...
    </div>
  );
}

export default function App() {
  const session = useSession();
  const [templates, setTemplates] = useState({ builtin: [], custom: [] });

  async function refreshTemplates() {
    try {
      const data = await apiFetch("/api/templates");
      setTemplates(data);
    } catch {
      setTemplates({ builtin: [], custom: [] });
    }
  }

  useEffect(() => {
    if (session.authenticated) {
      refreshTemplates();
    }
  }, [session.authenticated]);

  if (session.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] text-muted-foreground">
        正在检查登录状态...
      </div>
    );
  }

  if (!session.authenticated) {
    return (
      <Suspense fallback={<PageFallback />}>
        <LoginPage onAuthenticated={session.refresh} />
      </Suspense>
    );
  }

  return (
    <Shell>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route
            path="/"
            element={<DashboardPage templates={templates} />}
          />
          <Route
            path="/templates"
            element={
              <TemplatesPage
                templates={templates}
                refreshTemplates={refreshTemplates}
              />
            }
          />
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </Suspense>
    </Shell>
  );
}
