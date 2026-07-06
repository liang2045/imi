import { describe, expect, it } from "vitest";
import { getAnalytics, groupCount } from "./analytics";
import type { Collaboration } from "./types";

const item = (overrides: Partial<Collaboration> = {}): Collaboration => ({
  id: "1",
  influencerId: "i",
  influencerName: "测试达人",
  month: "2026-06",
  status: "合作已完成",
  shippingStatus: "已签收",
  paymentStatus: "已付款",
  owner: "管理员",
  feeCents: 20000,
  plannedPublishDate: "2026-06-20",
  cooperationIntent: "达人OK",
  brandResult: "品牌通过",
  ...overrides,
});

describe("analytics", () => {
  it("计算花费、均价、预算和完成进度", () => {
    const result = getAnalytics([item(), item({ id: "2", feeCents: 30000, status: "样品寄送中" })], 100000);
    expect(result.spendCents).toBe(50000);
    expect(result.averageCents).toBe(25000);
    expect(result.budgetPercent).toBe(50);
    expect(result.executionPercent).toBe(50);
  });

  it("费用统计排除线下、策划和销售设计，并支持月份均价覆盖", () => {
    const result = getAnalytics([
      item({ id: "media", influencerName: "小红书站外推广", feeCents: 49291800 }),
      item({ id: "offline", influencerName: "线下渠道", feeCents: 99999900 }),
      item({ id: "plan", owner: "策划组", feeCents: 88888800 }),
      item({ id: "sales-design", owner: "销售设计组", feeCents: 77777700 }),
    ], 60000000, { averageCents: 229500 });
    expect(result.spendCents).toBe(49291800);
    expect(result.averageCents).toBe(229500);
    expect(result.budgetPercent).toBe(82);
  });

  it("按受控字段分组", () => {
    expect(groupCount([item(), item({ id: "2" })], "paymentStatus")).toEqual([{ name: "已付款", value: 2 }]);
  });
});
