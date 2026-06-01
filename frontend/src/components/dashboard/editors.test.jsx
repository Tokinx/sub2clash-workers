import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import {
  ReplacementEditor,
  RuleProviderEditor,
  RulesEditor,
  SubscriptionEditor,
} from "@/components/dashboard/editors.jsx";

function SubscriptionHarness() {
  const [subscriptions, setSubscriptions] = useState([{ url: "", remark: "" }]);
  return <SubscriptionEditor subscriptions={subscriptions} onChange={setSubscriptions} />;
}

function SubscriptionDragHarness() {
  const [subscriptions, setSubscriptions] = useState([
    { url: "https://example.com/source-a", remark: "A" },
    { url: "https://example.com/source-b", remark: "B" },
    { url: "https://example.com/source-c", remark: "C" },
  ]);

  return <SubscriptionEditor subscriptions={subscriptions} onChange={setSubscriptions} />;
}

function RuleProviderHarness() {
  const [providers, setProviders] = useState([]);
  return <RuleProviderEditor providers={providers} onChange={setProviders} />;
}

function RulesHarness() {
  const [rules, setRules] = useState([]);
  return <RulesEditor rules={rules} onChange={setRules} />;
}

function ReplacementHarness() {
  const [replacements, setReplacements] = useState([]);
  return <ReplacementEditor replacements={replacements} onChange={setReplacements} />;
}

describe("dashboard table editors", () => {
  it.each([
    ["订阅表格", SubscriptionHarness, "订阅地址", "https://example.com/subscription"],
    ["Rule Provider 表格", RuleProviderHarness, "名称", "private-provider"],
    ["规则表格", RulesHarness, "规则", "DOMAIN-SUFFIX,example.com,DIRECT"],
    ["替换表格", ReplacementHarness, "匹配正则", "香港|HK"],
  ])("%s 编辑首列时保持当前输入焦点", async (_, Harness, label, value) => {
    const user = userEvent.setup();

    render(<Harness />);

    const input = screen.getByRole("textbox", { name: label });
    await user.click(input);
    await user.type(input, value);

    const currentInput = screen.getByRole("textbox", { name: label });
    expect(currentInput).toBe(input);
    expect(currentInput).toHaveFocus();
    expect(currentInput).toHaveValue(value);
  });

  it("订阅表格拖拽行后按新顺序渲染", () => {
    const dataTransfer = {
      dropEffect: "",
      effectAllowed: "",
      setData: vi.fn(),
    };

    render(<SubscriptionDragHarness />);

    const handles = screen.getAllByRole("button", { name: /拖拽排序订阅第/ });
    const targetRow = handles[2].closest("tr");

    fireEvent.dragStart(handles[0], { dataTransfer });
    fireEvent.dragEnter(targetRow, { dataTransfer });
    fireEvent.dragOver(targetRow, { dataTransfer });
    fireEvent.drop(targetRow, { dataTransfer });

    expect(screen.getAllByRole("textbox", { name: "订阅地址" }).map((input) => input.value)).toEqual([
      "https://example.com/source-b",
      "https://example.com/source-c",
      "https://example.com/source-a",
    ]);
  });
});
