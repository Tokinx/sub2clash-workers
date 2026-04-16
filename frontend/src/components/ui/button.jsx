import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap px-4 text-[0.95rem] font-medium leading-none ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 disabled:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-[rgba(201,100,66,0.4)] bg-primary text-primary-foreground shadow-[0_12px_28px_rgba(201,100,66,0.18)] hover:bg-[#b85637]",
        destructive: "border-[rgba(181,51,51,0.18)] bg-[rgba(181,51,51,0.08)] text-destructive hover:bg-[rgba(181,51,51,0.14)]",
        outline: "border-border bg-background/80 text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "border-border bg-secondary text-secondary-foreground hover:bg-[#dfd7c7]",
        ghost: "border-transparent bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent px-0 text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-[var(--control-height)]",
        sm: "h-10 px-3 text-[0.88rem]",
        lg: "h-12 px-6 text-base",
        icon: "h-[var(--control-height)] w-[var(--control-height)] px-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
});
Button.displayName = "Button";

export { Button, buttonVariants };
