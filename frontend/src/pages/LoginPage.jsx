import { LockKeyhole, Sparkles } from "lucide-react";
import { useState } from "react";

import Field from "@/components/Field";
import SectionCard from "@/components/SectionCard.jsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api.js";

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
        body: JSON.stringify({ password }),
      });
      onAuthenticated();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      <div className="flex-1 mx-auto gap-8 grid lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <section className="h-full w-full flex flex-col pb-[40vh] lg:pb-0 overflow-auto lg:max-w-4xl max-h-200 mx-auto p-6 lg:px-6 gap-6">
          <p className="mb-3 text-[0.72rem] uppercase tracking-[0.18em] text-[var(--stone)]">Private Console</p>
          <h1 className="font-display text-[3rem] leading-[0.8] lg:text-[4.9rem]">
            Sub2Clash
            <br />
            <span className="text-[2rem] lg:text-[2.55rem]">on Cloudflare Workers</span>
          </h1>
          <p className="font-display mt-5 max-w-2xl text-base leading-8 text-muted-foreground">
            这是一个订阅聚合控制器，
            <br />
            暖色纸张只是外表，
            <br />
            核心是受保护的规则引擎和模板系统。
          </p>
          <div className="lg:flex-1"></div>
          <div className="lg:mt-10 grid lg:grid-cols-3 gap-4">
            {[
              ["Aggregation", "订阅与节点聚合，统一收口到一个可复用配置。"],
              ["Template", "支持自定义模板，避免每次都从 YAML 白纸开始。"],
              ["Routing", "Rules、Provider、替换与过滤可视化维护更轻松。"],
            ].map(([title, copy]) => (
              <div
                key={title}
                className="border-t-2 border-primary/5 px-4 py-4 hover:border-primary/80! hover:bg-amber-800/5 transition space-y-2"
              >
                {/* <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(201,100,66,0.12)] text-[var(--brand)]">
                    <Sparkles className="h-4 w-4" />
                  </div> */}
                <h2 className="font-display text-[1.35rem] leading-[1.08]">{title}</h2>
                <p className="font-display text-sm leading-7 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex bg-white/80 absolute bottom-0 w-full h-[40%] rounded-t-xl backdrop-blur-sm lg:rounded-none lg:backdrop-[unset] lg:relative lg:h-full lg:w-[unset]! lg:justify-center lg:items-center ">
          <SectionCard
            kicker="Access"
            title="Enter Password"
            description="请输入访问密码以进入控制台。"
            className="w-full max-w-lg mx-auto lg:mx-0 shadow-none lg:pb-[10%] lg:mb-0 bg-transparent"
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <Field label="Password">
                <Input
                  type="password"
                  value={password}
                  placeholder="Enter password"
                  className="shadow-none border border-primary/20! focus-visible:border-primary!  focus-visible:ring-0 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>

              {error ? (
                <Alert variant="destructive" className="text-amber-600 [&>svg]:text-amber-600">
                  <LockKeyhole className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={loading} className="w-full justify-center">
                <LockKeyhole className="h-4 w-4" />
                <span>{loading ? "Verifying..." : "Enter Dashboard"}</span>
              </Button>
            </form>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
