import { describe, expect, it } from "vitest";
import { hasOnlyManualSignedPrompt, hasSignedEvent, isSignedShipmentDescription } from "./shipping-status";

describe("shipping signed status detection", () => {
  it("does not treat manual confirmation prompts as real signed events", () => {
    expect(isSignedShipmentDescription("本地手工模式不自动查询真实物流轨迹，请人工刷新供应商系统或手工确认签收。")).toBe(false);
    expect(isSignedShipmentDescription("当前仍未识别签收，请点击确认签收按钮后更新。")).toBe(false);
    expect(hasSignedEvent([{ time: "2026-07-03 10:00", description: "本地手工模式不自动查询真实物流轨迹，请人工刷新供应商系统或手工确认签收。" }])).toBe(false);
  });

  it("recognizes explicit signed delivery traces", () => {
    expect(isSignedShipmentDescription("已签收，签收人：本人")).toBe(true);
    expect(isSignedShipmentDescription("您的快件已由菜鸟驿站代收")).toBe(true);
    expect(isSignedShipmentDescription("已人工确认签收")).toBe(true);
  });

  it("can identify records that only contain manual signed prompts", () => {
    expect(hasOnlyManualSignedPrompt([{ time: "2026-07-03 10:00", description: "请人工刷新供应商系统或手工确认签收。" }])).toBe(true);
    expect(hasOnlyManualSignedPrompt([{ time: "2026-07-03 10:00", description: "已签收，签收人：本人" }])).toBe(false);
  });
});
