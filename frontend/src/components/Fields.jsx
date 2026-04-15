import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn.js";

const fieldClassName = "flex flex-col gap-[0.55rem]";
const fieldLabelClassName = "text-[0.75rem] uppercase text-[var(--stone)]";
const controlClassName =
  "w-full h-[var(--control-height)] min-h-[var(--control-height)] rounded-[0.72rem] border border-[var(--border)] bg-[rgba(255,255,255,0.82)] px-[0.92rem] text-[0.95rem] leading-[1.5] text-[var(--ink)] outline-none transition-[border-color,box-shadow,transform] duration-200 focus-visible:border-[rgba(201,100,66,0.55)] focus-visible:shadow-[0_0_0_3px_rgba(201,100,66,0.12)]";
const triggerBaseClassName = "flex items-center justify-between gap-3 text-left";
const triggerOpenClassName = "border-[rgba(201,100,66,0.55)] shadow-[0_0_0_3px_rgba(201,100,66,0.12)]";
const menuClassName =
  "absolute inset-x-0 top-[calc(100%+0.45rem)] z-30 overflow-hidden rounded-[0.78rem] border border-[var(--border)] bg-[rgba(250,249,245,0.98)] shadow-[0_18px_36px_rgba(20,20,19,0.1)]";
const optionClassName =
  "flex min-h-[calc(var(--control-height)-0.25rem)] w-full items-center justify-between gap-3 rounded-[0.64rem] border-0 bg-transparent px-[0.78rem] py-[0.72rem] text-left text-[var(--ink)] transition-colors duration-150 hover:bg-[rgba(201,100,66,0.08)]";
const optionActiveClassName = "bg-[rgba(201,100,66,0.14)]";

function useDismissableLayer(open, onClose, refs) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event) {
      const inside = refs.some((ref) => ref.current && ref.current.contains(event.target));
      if (!inside) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, refs]);
}

function FieldFrame({ label, className = "", labelClassName = "", children }) {
  return (
    <label className={cn(fieldClassName, className)}>
      {label ? <span className={cn(fieldLabelClassName, labelClassName)}>{label}</span> : null}
      {children}
    </label>
  );
}

function DropdownShell({ label, className = "", labelClassName = "", trigger, panel, open, onClose }) {
  const wrapperRef = useRef(null);
  const panelRef = useRef(null);

  useDismissableLayer(open, onClose, [wrapperRef, panelRef]);

  return (
    <FieldFrame label={label} className={className} labelClassName={labelClassName}>
      <div ref={wrapperRef} className="relative">
        {trigger}
        {open ? (
          <div ref={panelRef} className={menuClassName}>
            {panel}
          </div>
        ) : null}
      </div>
    </FieldFrame>
  );
}

function CaretIcon({ open }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("h-4 w-4 transition-transform duration-200", open && "rotate-180")}
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 6.5 8 10l4-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-6 w-6" fill="none" aria-hidden="true">
      <path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  className = "",
  labelClassName = "",
  inputClassName = "",
  readOnly,
  ...props
}) {
  return (
    <FieldFrame label={label} className={className} labelClassName={labelClassName}>
      <input
        {...props}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly ?? !onChange}
        placeholder={placeholder}
        className={cn(controlClassName, inputClassName)}
      />
    </FieldFrame>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 6,
  className = "",
  labelClassName = "",
  inputClassName = "",
}) {
  return (
    <FieldFrame label={label} className={className} labelClassName={labelClassName}>
      <textarea
        rows={rows}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={!onChange}
        placeholder={placeholder}
        className={cn(controlClassName, "h-auto min-h-[8.5rem] resize-y px-[0.92rem] py-[0.72rem]", inputClassName)}
      />
    </FieldFrame>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  className = "",
  labelClassName = "",
  ariaLabel,
  triggerClassName = "",
  panelClassName = "",
  optionClassName: customOptionClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) || options[0];

  return (
    <DropdownShell
      label={label}
      className={className}
      labelClassName={labelClassName}
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button
          type="button"
          className={cn(controlClassName, triggerBaseClassName, triggerClassName, open && triggerOpenClassName)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel || label}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="truncate text-left">{selected?.label || "请选择"}</span>
          <CaretIcon open={open} />
        </button>
      }
      panel={
        <div role="listbox" className={cn("max-h-64 overflow-auto py-2", panelClassName)}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                optionClassName,
                option.value === value && optionActiveClassName,
                customOptionClassName,
                "rounded-none",
              )}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      }
    />
  );
}

export function Autocomplete({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = "",
  labelClassName = "",
  ariaLabel,
  triggerClassName = "",
  inputClassName = "",
  panelClassName = "",
  optionClassName: customOptionClassName = "",
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const inputRef = useRef(null);
  const selectedOption = useMemo(() => options.find((option) => option.value === value) || null, [options, value]);

  useEffect(() => {
    setQuery(selectedOption?.label || value || "");
    if (!open) {
      setSearchQuery("");
    }
  }, [open, selectedOption, value]);

  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return options;
    }
    return options.filter((option) =>
      [option.label, option.value, option.hint]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(keyword)),
    );
  }, [options, searchQuery]);

  function openWithAllOptions() {
    setOpen(true);
    setSearchQuery("");
  }

  function toggleMenu() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      setSearchQuery("");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <DropdownShell
      label={label}
      className={className}
      labelClassName={labelClassName}
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <div
          className={cn(
            controlClassName,
            triggerBaseClassName,
            triggerClassName,
            "flex items-center gap-3 pr-0 focus-within:border-[rgba(201,100,66,0.55)] focus-within:shadow-[0_0_0_3px_rgba(201,100,66,0.12)]",
            open && triggerOpenClassName,
          )}
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            placeholder={placeholder}
            aria-label={ariaLabel || label}
            className={cn("min-w-0 flex-1 border-0 bg-transparent pl-0 text-inherit outline-none", inputClassName)}
            onFocus={openWithAllOptions}
            onChange={(event) => {
              const nextValue = event.target.value;
              setQuery(nextValue);
              setSearchQuery(nextValue);
              onChange(nextValue);
              setOpen(true);
            }}
          />
          <button
            type="button"
            className="inline-flex h-[calc(var(--control-height)-2px)] w-[2.85rem] shrink-0 items-center justify-center rounded-r-[0.72rem] border-0 bg-transparent text-[var(--stone)]"
            onMouseDown={(event) => event.preventDefault()}
            onClick={toggleMenu}
            aria-label={open ? "收起候选项" : "展开候选项"}
          >
            <CaretIcon open={open} />
          </button>
        </div>
      }
      panel={
        <div className={cn("max-h-64 overflow-auto py-2", panelClassName)}>
          {filteredOptions.length ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn(
                  optionClassName,
                  option.value === value && optionActiveClassName,
                  customOptionClassName,
                  "rounded-none",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setQuery(option.label);
                  setSearchQuery("");
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.95rem]">{option.label}</span>
                  {option.hint ? <span className="text-[0.78rem] text-[var(--stone)]">{option.hint}</span> : null}
                </span>
                {option.value === value ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[rgba(201,100,66,0.1)] px-2 py-1 text-[0.68rem] uppercase tracking-[0.12em] text-[var(--brand)]">
                    <CheckIcon />
                    <span>已选</span>
                  </span>
                ) : null}
              </button>
            ))
          ) : (
            <p className="m-0 px-[0.85rem] py-[0.8rem] text-[0.92rem] text-[var(--muted)]">
              没有匹配项，保留你当前输入的值。
            </p>
          )}
        </div>
      }
    />
  );
}

export function Toggle({ label, checked, onChange, compact = false, className = "", switchClassName = "" }) {
  const switchBaseClassName = cn(
    "relative h-6 w-11 shrink-0 rounded-full transition",
    checked ? "bg-[var(--brand)]" : "bg-[var(--warm-gray)]",
    switchClassName,
  );

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={cn("inline-flex", switchBaseClassName, className)}
      >
        <span
          className={cn(
            "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition",
            checked ? "left-[23px]" : "left-[3px]",
          )}
        />
      </button>
    );
  }

  return (
    <label
      className={cn(
        "flex min-h-[var(--control-height)] items-center justify-between rounded-[0.72rem] border border-[var(--border)] bg-[rgba(255,255,255,0.4)] px-3.5 py-2.5 text-sm",
        className,
      )}
    >
      <span className="pr-3 leading-6">{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={switchBaseClassName}>
        <span
          className={cn(
            "absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition",
            checked ? "left-[23px]" : "left-[3px]",
          )}
        />
      </button>
    </label>
  );
}
