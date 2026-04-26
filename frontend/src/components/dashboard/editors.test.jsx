import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
});
