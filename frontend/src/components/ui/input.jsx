import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(({ className, type, ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-[var(--control-height)] w-full bg-[rgba(255,255,255,0.82)] px-4 py-2 text-[0.95rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-[rgba(201,100,66,0.55)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(201,100,66,0.14)] disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
