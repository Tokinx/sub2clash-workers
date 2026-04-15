import { cn } from "../lib/cn.js";

const baseClassName =
  "inline-flex h-[var(--control-height)] items-center justify-center gap-2 rounded-[0.72rem] px-4 text-ms leading-none transition duration-150 hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-60 disabled:translate-y-0";

const variantClassNames = {
  primary: "border-[rgba(201,100,66,0.4)] bg-[var(--brand)] text-[var(--ivory)]",
  secondary: "border-[var(--border)] bg-[rgba(255,255,255,0.76)] text-[var(--ink)]",
  subtle: "border-[var(--border)] bg-[rgba(255,255,255,0.46)] text-[var(--muted)]",
  danger: "border-[rgba(181,51,51,0.18)] bg-[rgba(181,51,51,0.06)] text-[var(--error)]"
};

const sizeClassNames = {
  default: "",
  icon: "w-[var(--control-height)] px-0!"
};

export function Button({
  className = "",
  variant = "secondary",
  size = "default",
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={cn(
        baseClassName,
        variantClassNames[variant] || variantClassNames.secondary,
        sizeClassNames[size] || sizeClassNames.default,
        className
      )}
      {...props}
    />
  );
}
