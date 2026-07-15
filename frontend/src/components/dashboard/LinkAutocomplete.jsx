import { ChevronsUpDown, Link2, Check } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function formatTimestamp(value) {
  if (!value) {
    return "更新时间未知";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "更新时间未知";
  }

  const parts = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  })
    .formatToParts(date)
    .reduce((result, part) => ({ ...result, [part.type]: part.value }), {});

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export default function LinkAutocomplete({ value, options, loading = false, placeholder, onChange }) {
  const [open, setOpen] = useState(false);
  const [activeValue, setActiveValue] = useState("");
  const [contentWidth, setContentWidth] = useState(null);
  const wrapperRef = useRef(null);
  const suppressAutoSelectionRef = useRef(false);

  function preventAnchorDismiss(event) {
    if (wrapperRef.current?.contains(event.target)) {
      event.preventDefault();
    }
  }

  useEffect(() => {
    if (!open || !wrapperRef.current) {
      return;
    }

    setContentWidth(wrapperRef.current.getBoundingClientRect().width);
  }, [open]);

  useEffect(() => {
    const selectedOption = options.find((option) => option.path === value);
    setActiveValue(selectedOption?.id || "");
  }, [options, value]);

  useEffect(() => {
    const selectedOption = options.find((option) => option.path === value);
    if (!open || selectedOption) {
      suppressAutoSelectionRef.current = false;
      return;
    }

    suppressAutoSelectionRef.current = true;
    const timer = window.setTimeout(() => {
      suppressAutoSelectionRef.current = false;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      suppressAutoSelectionRef.current = false;
    };
  }, [open, options, value]);

  function handleActiveValueChange(nextValue) {
    if (suppressAutoSelectionRef.current) {
      return;
    }

    setActiveValue(nextValue);
  }

  const orderedOptions = useMemo(() => {
    const keyword = value.trim().toLowerCase();
    if (!keyword) {
      return options;
    }

    const matched = [];
    const rest = [];

    options.forEach((option) => {
      const isMatched = [option.id, option.path, option.url, option.remark].some((item) =>
        String(item || "").toLowerCase().includes(keyword),
      );
      if (isMatched) {
        matched.push(option);
        return;
      }

      rest.push(option);
    });

    return [...matched, ...rest];
  }, [options, value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className="relative">
          <Input
            value={value}
            aria-label="导入链接"
            placeholder={placeholder}
            className="pr-12 text-[0.84rem]"
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              onChange(event.target.value);
              setOpen(true);
            }}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-[calc(var(--control-height)-0.5rem)] w-9 bg-transparent!"
              aria-label={open ? "收起短链接候选" : "展开短链接候选"}
            >
              <ChevronsUpDown className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="p-0 border-0"
        style={contentWidth ? { width: `${contentWidth}px` } : undefined}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onInteractOutside={preventAnchorDismiss}
      >
        {/* shouldFilter={false} value={activeValue} */}
        <Command onValueChange={handleActiveValueChange}>
          <CommandList>
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">加载短链目录中...</div>
            ) : orderedOptions.length ? (
              <CommandGroup>
                {orderedOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onChange(option.path);
                      setOpen(false);
                    }}
                    className={cn("bg-transparent! hover:bg-[rgba(201,100,66,0.05)]!", activeValue === option.id && "bg-[rgba(201,100,66,0.1)]!")}
                  >
                    <Link2 className="h-4 w-4 text-[var(--brand)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[0.84rem] text-foreground">{option.path}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {option.remark ? `${option.remark} · ` : ""}最近更新：{formatTimestamp(option.updatedAt)}
                      </p>
                    </div>
                    {option.id === activeValue ? <Check className="h-4 w-4 text-[var(--brand)]" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">还没有历史订阅链接，可继续手动输入。</div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
