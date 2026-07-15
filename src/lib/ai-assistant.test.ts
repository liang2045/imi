import { describe, expect, it } from "vitest";
import { buildLocalAssistantResponse } from "./ai-assistant";

const snapshot = {
  month: "2026-07",
  collaborationCount: 4,
  spendYuan: 32760,
  budgetYuan: 1650000,
  budgetPercent: 2,
  averageYuan: 2295,
  publishedCount: 2,
  pendingCount: 2,
  executionPercent: 50,
  statusCounts: [{ name: "样品寄送中", value: 2 }],
  projects: [{ name: "小红书", budgetYuan: 600000, rechargedYuan: 120000, consumedYuan: 83600, remainingRechargeYuan: 480000 }],
  shipments: { pending: 1, shipped: 2, signed: 1 },
} as const;

describe("AI 本地数据助手", () => {
  it("根据业务快照生成预算和物流诊断", () => {
    const result = buildLocalAssistantResponse("生成本月管理报告", snapshot);
    expect(result.title).toContain("管理报告");
    expect(result.findings.some((finding) => finding.title === "样品物流")).toBe(true);
    expect(result.actions.length).toBeGreaterThan(0);
  });
});
