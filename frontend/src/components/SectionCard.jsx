import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SectionCard({ title, kicker, description, children, tone = "light", className = "", contentClassName = "" }) {
  const dark = tone === "dark";

  return (
    <Card
      className={cn(
        dark
          ? "surface-dark border-[var(--dark-border)] bg-[var(--dark)] text-[var(--paper-soft)] shadow-[0_24px_60px_rgba(20,20,19,0.18)]"
          : "border-border bg-card",
        className
      )}
    >
      <CardHeader>
        {kicker ? (
          <p className={cn("text-[0.72rem] uppercase tracking-[0.18em]", dark ? "text-[var(--silver)]" : "text-[var(--stone)]")}>
            {kicker}
          </p>
        ) : null}
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription className={dark ? "text-[var(--silver)]" : ""}>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
