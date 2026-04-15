import { useEffect } from "react";

import { Button } from "../Button.jsx";

function CloseIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" aria-hidden="true">
      <path d="m3.5 3.5 9 9m0-9-9 9" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export default function PreviewDialog({
  open,
  loading,
  preview,
  stats,
  warnings,
  previewError,
  subscriptionInfo,
  onClose
}) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,20,19,0.54)] p-4 backdrop-blur-[8px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-[980px] rounded-[0.9rem] border border-[var(--dark-border)] bg-[rgba(27,27,25,0.96)] shadow-[0_14px_32px_rgba(20,20,19,0.12)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 md:p-6">
          <div>
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--silver)]">Preview</p>
            <h2 className="mt-2 font-display text-[1.7rem] leading-[1.05] text-[var(--ivory)]">输出预览</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--silver)]">
              只有点击“预览 YAML”时才会向 Worker 请求最新渲染结果。
            </p>
          </div>
          <Button
            variant="subtle"
            size="icon"
            className="border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] text-[var(--silver)]"
            aria-label="关闭预览"
            onClick={onClose}
          >
            <CloseIcon />
          </Button>
        </div>

        <div className="px-5 pb-5 md:px-6 md:pb-6">
          {stats ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["节点", stats.proxyCount],
                ["国家组", stats.countryGroupCount],
                ["模板", stats.templateId]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[0.72rem] border border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] p-[0.95rem]"
                >
                  <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--silver)]">{label}</p>
                  <p className="mt-2 font-display text-[1.45rem] leading-none text-[var(--ivory)]">{value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {subscriptionInfo ? (
              <p className="rounded-[0.72rem] border border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] px-4 py-3 text-xs text-[var(--silver)]">
                subscription-userinfo: {subscriptionInfo}
              </p>
            ) : null}
            {warnings.length ? (
              <ul className="rounded-[0.72rem] border border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] px-4 py-3 text-sm text-[var(--silver)]">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
            {previewError ? (
              <p className="rounded-[0.72rem] bg-[rgba(201,100,66,0.18)] px-4 py-3 text-sm text-[#ffe9e1]">
                {previewError}
              </p>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-4 flex h-[24rem] items-center justify-center gap-3 text-sm text-[var(--silver)]">
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span>正在渲染最新配置...</span>
            </div>
          ) : (
            <pre className="mt-4 h-[24rem] overflow-auto bg-[rgba(0,0,0,0.16)] p-4 text-xs leading-6 text-[var(--ivory)]">
              {preview || ""}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
