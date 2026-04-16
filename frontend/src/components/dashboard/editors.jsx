import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const RULE_PROVIDER_BEHAVIOR_OPTIONS = [
  { value: "classical", label: "classical" },
  { value: "domain", label: "domain" },
  { value: "ipcidr", label: "ipcidr" },
];

export function createEmptyReplacement() {
  return { pattern: "", replacement: "" };
}

export function createEmptyRuleProvider() {
  return { name: "", group: "", behavior: "", url: "", prepend: false };
}

export function createEmptyRule() {
  return { value: "", prepend: false };
}

export function createEmptySubscription() {
  return { url: "", prefix: "" };
}

export function cleanSubscriptions(items) {
  return items.filter((item) => item.url.trim());
}

export function normalizeNodes(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function ensureTableRow(items, createItem) {
  return items.length ? items : [createItem()];
}

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="mb-5">
      {eyebrow ? (
        <p className="font-display text-3xl tracking-[0.18em] text-[var(--stone)]/20 -mb-6">{eyebrow}</p>
      ) : null}
      <h2 className="font-display text-[1.55rem] md:text-[1.9rem]">{title}</h2>
      {description ? <p className="font-display text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function EditorSection({ eyebrow, title, description, children }) {
  return (
    <section className="pt-6">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      {children}
    </section>
  );
}

function TableFrame({ minWidthClassName = "", children }) {
  return (
    <div className="bg-[rgba(255,255,255,0.34)]">
      <div className="w-full overflow-auto">
        <div className={minWidthClassName}>{children}</div>
      </div>
    </div>
  );
}

function TableTextInput({ className = "", ...props }) {
  return <Input className={cn("bg-[rgba(255,255,255,0.88)]", className)} {...props} />;
}

function IconActionButton({ label, onClick, disabled = false, tone = "destructive" }) {
  return (
    <Button
      type="button"
      aria-label={label}
      variant={tone}
      size="icon"
      disabled={disabled}
      onClick={onClick}
      className={cn(tone === "destructive" ? "" : "text-muted-foreground")}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}

function AddRowButton({ ariaLabel, onClick }) {
  return (
    <Button
      type="button"
      variant="secondary"
      aria-label={ariaLabel}
      className="w-full h-8 flex bg-[rgba(255,255,255,0.34)] text-primary/80 hover:bg-muted/50 active:bg-muted"
      onClick={onClick}
    >
      <Plus className="h-4 w-4" />
    </Button>
  );
}

function CompactSwitch({ label, checked, onCheckedChange }) {
  return (
    <div className="flex min-h-[var(--control-height)] items-center justify-center">
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={label} />
    </div>
  );
}

function BehaviorCombobox({ value, onChange, placeholder = "选择或输入行为", ariaLabel = "行为" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
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
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    if (!open || !wrapperRef.current) {
      return;
    }

    setContentWidth(wrapperRef.current.getBoundingClientRect().width);
  }, [open]);

  useEffect(() => {
    const selectedOption = RULE_PROVIDER_BEHAVIOR_OPTIONS.find((option) => option.value === value);
    setActiveValue(selectedOption?.value || "");
  }, [value]);

  useEffect(() => {
    const selectedOption = RULE_PROVIDER_BEHAVIOR_OPTIONS.find((option) => option.value === value);
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
  }, [open, value]);

  const orderedOptions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return RULE_PROVIDER_BEHAVIOR_OPTIONS;
    }

    const matched = [];
    const rest = [];

    RULE_PROVIDER_BEHAVIOR_OPTIONS.forEach((option) => {
      const isMatched = [option.label, option.value].some((item) => item.toLowerCase().includes(keyword));
      if (isMatched) {
        matched.push(option);
        return;
      }

      rest.push(option);
    });

    return [...matched, ...rest];
  }, [query]);

  function handleInputChange(nextValue) {
    setQuery(nextValue);
    onChange(nextValue);
    setOpen(true);
  }

  function handleActiveValueChange(nextValue) {
    if (suppressAutoSelectionRef.current) {
      return;
    }

    setActiveValue(nextValue);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={wrapperRef} className="relative">
          <Input
            value={query}
            aria-label={ariaLabel}
            placeholder={placeholder}
            className="bg-[rgba(255,255,255,0.88)] pr-12"
            onFocus={() => setOpen(true)}
            onChange={(event) => handleInputChange(event.target.value)}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1 h-[calc(var(--control-height)-0.5rem)] w-9 text-[var(--stone)] bg-transparent!"
              aria-label={open ? "收起候选项" : "展开候选项"}
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
        <Command shouldFilter={false} value={activeValue} onValueChange={handleActiveValueChange}>
          <CommandList>
            {orderedOptions.length ? (
              <CommandGroup>
                {orderedOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => {
                      setQuery(option.label);
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn("bg-transparent! hover:bg-[rgba(201,100,66,0.05)]!", option.value === value && "bg-[rgba(201,100,66,0.1)]!")}
                  >
                    <span className="flex-1">{option.label}</span>
                    {option.value === value ? <Check className="h-4 w-4 text-[var(--brand)]" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : query ? (
              <CommandEmpty>没有匹配项，保留当前输入值。</CommandEmpty>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SubscriptionEditor({ subscriptions, onChange }) {
  const rows = ensureTableRow(subscriptions, createEmptySubscription);
  const canDelete = rows.length > 1;

  return (
    <div>
      <TableFrame minWidthClassName="min-w-[42rem]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>订阅地址</TableHead>
              <TableHead className="w-[14rem]">节点前缀</TableHead>
              <TableHead className="w-[5rem] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={`${item.url}-${index}`}>
                <TableCell>
                  <TableTextInput
                    value={item.url}
                    aria-label="订阅地址"
                    placeholder="https://example.com/subscription"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], url: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TableTextInput
                    value={item.prefix}
                    aria-label="节点前缀"
                    placeholder="可选，用于区分不同节点"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], prefix: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <IconActionButton
                    label="删除订阅"
                    disabled={!canDelete}
                    onClick={() => canDelete && onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      <AddRowButton ariaLabel="新增订阅" onClick={() => onChange([...rows, createEmptySubscription()])} />
    </div>
  );
}

export function RuleProviderEditor({ providers, onChange }) {
  const rows = ensureTableRow(providers, createEmptyRuleProvider);
  const canDelete = rows.length > 1;

  return (
    <div>
      <TableFrame minWidthClassName="min-w-[64rem]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>策略组</TableHead>
              <TableHead>行为</TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="w-[5rem] text-center">置顶</TableHead>
              <TableHead className="w-[5rem] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={`${item.name}-${index}`}>
                <TableCell>
                  <TableTextInput
                    value={item.name}
                    aria-label="名称"
                    placeholder="规则名称"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], name: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TableTextInput
                    value={item.group}
                    aria-label="策略组"
                    placeholder="节点选择"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], group: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <BehaviorCombobox
                    value={item.behavior}
                    onChange={(value) => {
                      const next = [...rows];
                      next[index] = { ...next[index], behavior: value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TableTextInput
                    value={item.url}
                    aria-label="Rule Provider URL"
                    placeholder="https://example.com/provider.yaml"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], url: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CompactSwitch
                    label="插入到规则前部"
                    checked={Boolean(item.prepend)}
                    onCheckedChange={(checked) => {
                      const next = [...rows];
                      next[index] = { ...next[index], prepend: checked };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <IconActionButton
                    label="删除订阅规则"
                    disabled={!canDelete}
                    onClick={() => canDelete && onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      <AddRowButton ariaLabel="新增 Rule Provider" onClick={() => onChange([...rows, createEmptyRuleProvider()])} />
    </div>
  );
}

export function RulesEditor({ rules, onChange }) {
  const rows = ensureTableRow(rules, createEmptyRule);
  const canDelete = rows.length > 1;

  return (
    <div>
      <TableFrame minWidthClassName="min-w-[40rem]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>规则</TableHead>
              <TableHead className="w-[5rem] text-center">置顶</TableHead>
              <TableHead className="w-[5rem] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={`${item.value}-${index}`}>
                <TableCell>
                  <TableTextInput
                    value={item.value}
                    aria-label="规则"
                    placeholder="DOMAIN-SUFFIX,openai.com,DIRECT"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], value: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <CompactSwitch
                    label="置顶"
                    checked={Boolean(item.prepend)}
                    onCheckedChange={(checked) => {
                      const next = [...rows];
                      next[index] = { ...next[index], prepend: checked };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <IconActionButton
                    label="删除规则"
                    disabled={!canDelete}
                    onClick={() => canDelete && onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      <AddRowButton ariaLabel="新增规则" onClick={() => onChange([...rows, createEmptyRule()])} />
    </div>
  );
}

export function ReplacementEditor({ replacements, onChange }) {
  const rows = ensureTableRow(replacements, createEmptyReplacement);
  const canDelete = rows.length > 1;

  return (
    <div>
      <TableFrame minWidthClassName="min-w-[42rem]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>匹配正则</TableHead>
              <TableHead>替换文本</TableHead>
              <TableHead className="w-[5rem] text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item, index) => (
              <TableRow key={`${item.pattern}-${index}`}>
                <TableCell>
                  <TableTextInput
                    value={item.pattern}
                    aria-label="匹配正则"
                    placeholder="香港|HK"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], pattern: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TableTextInput
                    value={item.replacement}
                    aria-label="替换文本"
                    placeholder="Hong Kong"
                    onChange={(event) => {
                      const next = [...rows];
                      next[index] = { ...next[index], replacement: event.target.value };
                      onChange(next);
                    }}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <IconActionButton
                    label="删除替换规则"
                    disabled={!canDelete}
                    onClick={() => canDelete && onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableFrame>

      <AddRowButton ariaLabel="新增替换规则" onClick={() => onChange([...rows, createEmptyReplacement()])} />
    </div>
  );
}
