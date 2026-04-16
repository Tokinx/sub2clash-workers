import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Shell from "./components/Shell.jsx";
import { useSession } from "./hooks/useSession.js";
import { apiFetch } from "./lib/api.js";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import TemplatesPage from "./pages/TemplatesPage.jsx";

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
    return <LoginPage onAuthenticated={session.refresh} />;
  }

  return (
    <Shell>
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
    </Shell>
  );
}
