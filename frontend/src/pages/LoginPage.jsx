import { useState } from "react";

import { Button } from "../components/Button.jsx";
import { Input } from "../components/Fields.jsx";
import { apiFetch } from "../lib/api.js";

export default function LoginPage({ onAuthenticated }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });
      onAuthenticated();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] px-5 py-8 text-[var(--ink)]  flex items-center">
      <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pb-[20%]">
        <section className="">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--stone)]">
            Private Console
          </p>
          <h1 className="font-display text-[3rem] leading-[0.8] md:text-[4.7rem]">
            Sub2Clash
            <br />
            <span className="text-[2rem] md:text-[2.6rem]">on Cloudflare Workers</span>
          </h1>
          <div className="mt-10 grid gap-4 grid-cols-3">
            {[
              ["Aggregation", "Automatic aggregation of rules from multiple sources."],
              ["Template", "Predefined templates for quick setup and configuration."],
              ["Rules", "Flexible rule and tag system to meet personalized needs."]
            ].map(([title, copy]) => (
              <article
                key={title}
                className="font-display rounded-[1.4rem] border border-[var(--border)] bg-[var(--card)] p-4"
              >
                <h2 className="text-xl">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-[var(--dark-border)] bg-[var(--dark)] p-8 text-[var(--ivory)] shadow-[0_24px_70px_rgba(20,20,19,0.18)] md:p-10">
          <p className="mb-2 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--silver)]">
            Access
          </p>
          <h2 className="font-display text-[2.2rem]">Enter Password</h2>
          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-4"
          >
            <Input
              label="Password"
              labelClassName="text-[var(--silver)]"
              type="password"
              value={password}
              onChange={setPassword}
              inputClassName="border-[var(--dark-border)] bg-[rgba(255,255,255,0.04)] text-[var(--ivory)]"
              placeholder="Enter password"
            />
            {error ? <p className="text-sm text-[#ffb7a2]">{error}</p> : null}
            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full rounded-[0.9rem] font-medium"
            >
              {loading ? "Verifying..." : "Enter Dashboard"}
            </Button>
          </form>
        </section>
      </div>
    </div>
  );
}
