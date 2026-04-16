import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Field({ label, htmlFor, description, className = "", labelClassName = "", descriptionClassName = "", children }) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} className={labelClassName}>
          {label}
        </Label>
      ) : null}
      {children}
      {description ? <p className={cn("text-sm leading-6 text-muted-foreground", descriptionClassName)}>{description}</p> : null}
    </div>
  );
}
