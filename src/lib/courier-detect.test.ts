import { describe, expect, it } from "vitest";
import { detectCourierByTrackingNo } from "./courier-detect";

describe("detectCourierByTrackingNo", () => {
  it("detects common prefixed tracking numbers", () => {
    expect(detectCourierByTrackingNo("SF202606180001")).toBe("顺丰速运");
    expect(detectCourierByTrackingNo("JDV12345678901")).toBe("京东物流");
    expect(detectCourierByTrackingNo("YT123456789012")).toBe("圆通速递");
    expect(detectCourierByTrackingNo("STO123456789012")).toBe("申通快递");
    expect(detectCourierByTrackingNo("JT123456789012")).toBe("极兔速递");
  });

  it("uses conservative numeric heuristics", () => {
    expect(detectCourierByTrackingNo("73715675021956")).toBe("中通快递");
    expect(detectCourierByTrackingNo("88715675021956")).toBe("圆通速递");
  });

  it("does not force unknown numbers", () => {
    expect(detectCourierByTrackingNo("ABC")).toBeNull();
    expect(detectCourierByTrackingNo("UNKNOWN123456")).toBeNull();
  });
});
