import { describe, expect, it } from "vitest";
import { applyReviewFixes, buildDeterministicImportReview } from "@/lib/ai-import-review";

describe("AI import review rules", () => {
  it("flags duplicated creators and normalizes selected values without mutating the source rows", () => {
    const rows = [{ "达人名称": " 瓜瓜 ", "平台账号": "@guagua", "参考报价": "1,680" }, { "达人名称": "瓜瓜", "平台账号": "@guagua", "参考报价": "-1" }];
    const review = buildDeterministicImportReview({ tableType: "influencers", headers: Object.keys(rows[0]), rows });
    expect(review.issues.some((issue) => issue.id.startsWith("duplicate-"))).toBe(true);
    expect(review.issues.some((issue) => issue.id.startsWith("invalid-number-"))).toBe(true);
    const trimmed = applyReviewFixes(rows, review.fixes, review.fixes.map((fix) => fix.id));
    expect(rows[0]["达人名称"]).toBe(" 瓜瓜 ");
    expect(trimmed[0]["达人名称"]).toBe("瓜瓜");
  });

  it("checks project budget relationships", () => {
    const rows = [{ "项目": "小红书", "充值预算": 100, "已充值": 120, "已消耗": 80, "剩余可充值": 10 }];
    const review = buildDeterministicImportReview({ tableType: "projectProgress", headers: Object.keys(rows[0]), rows });
    expect(review.issues.map((issue) => issue.id)).toContain("recharge-over-budget-0");
    expect(review.issues.map((issue) => issue.id)).toContain("remaining-mismatch-0");
  });

  it("checks required shipping fields and tracking number", () => {
    const rows = [{ "达人": "", "样品数量": 0, "快递公司": "顺丰", "快递单号": "123" }];
    const review = buildDeterministicImportReview({ tableType: "shipping", headers: Object.keys(rows[0]), rows });
    expect(review.issues.filter((issue) => issue.severity === "error").length).toBeGreaterThan(2);
  });
});
