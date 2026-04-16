import { AlertCircle, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

function PreviewStat({ label, value }) {
  return (
    <Card className="border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] shadow-none">
      <CardContent className="space-y-2 p-4">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-[var(--silver)]">{label}</p>
        <p className="font-display text-[1.45rem] leading-none text-[var(--paper-soft)]">{value}</p>
      </CardContent>
    </Card>
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
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="gap-0 p-0">
        <div className="p-5 md:p-6">
          <DialogHeader className="pr-12">
            <p className="text-[0.72rem] uppercase tracking-[0.18em] text-[var(--silver)]">Preview</p>
            <DialogTitle>输出预览</DialogTitle>
            {/* <DialogDescription>只有点击“预览 YAML”时才会向 Worker 请求最新渲染结果。</DialogDescription> */}
          </DialogHeader>

          {stats ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PreviewStat label="节点" value={stats.proxyCount} />
              <PreviewStat label="国家组" value={stats.countryGroupCount} />
              <PreviewStat label="模板" value={stats.templateId} />
            </div>
          ) : null}

          <div className="mt-4 space-y-3">
            {subscriptionInfo ? (
              <Alert className="border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] text-[var(--silver)]">
                <AlertDescription>subscription-userinfo: {subscriptionInfo}</AlertDescription>
              </Alert>
            ) : null}

            {warnings.length ? (
              <Alert className="border-[var(--dark-border)] bg-[rgba(250,249,245,0.04)] text-[var(--silver)]">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-3">
                    {warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            ) : null}

            {previewError ? (
              <Alert variant="destructive" className="text-[#ffe9e1] [&>svg]:text-[#ffe9e1]">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{previewError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        </div>

        <Separator className="bg-[var(--dark-border)]" />

        <div className="px-5 pb-5 pt-4 md:px-6 md:pb-6">
          {loading ? (
            <div className="flex h-[24rem] items-center justify-center gap-3 text-sm text-[var(--silver)]">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>正在渲染最新配置...</span>
            </div>
          ) : (
            <ScrollArea className="h-[24rem] bg-[rgba(0,0,0,0.16)]">
              <pre className="m-0 p-4 text-xs leading-6 text-[var(--paper-soft)]">{preview || ""}</pre>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
