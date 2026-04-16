import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[8.5rem] w-full bg-[rgba(255,255,255,0.82)] px-4 py-3 text-[0.95rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] placeholder:text-muted-foreground focus-visible:border-[rgba(201,100,66,0.55)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(201,100,66,0.14)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export { Textarea };
