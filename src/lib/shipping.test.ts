import { afterEach, describe, expect, it, vi } from "vitest";
import { getShippingModeInfo, getShippingProviderName, Kuaidi100Provider, MockShippingProvider } from "./shipping";

describe("shipping provider accuracy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps mock shipping as manual mode without fake delivery states", async () => {
    const provider = new MockShippingProvider();
    const events = await provider.refreshTracking("SF202606180015", { courier: "顺丰速运" });

    expect(events.map((event) => event.description).join(" ")).not.toMatch(/已签收|异常|预计 2-3 天/);
    expect(events.some((event) => event.description.includes("本地手工模式"))).toBe(true);
  });

  it("reports manual mode when kuaidi100 credentials are absent", () => {
    vi.stubEnv("SHIPPING_PROVIDER", "kuaidi100");
    vi.stubEnv("KUAIDI100_CUSTOMER", "");
    vi.stubEnv("KUAIDI100_KEY", "");

    const provider = getShippingProviderName();
    const mode = getShippingModeInfo(provider);

    expect(provider).toBe("mock");
    expect(mode).toMatchObject({ mode: "manual", canAutoTrack: false, requiresManualConfirm: true });
  });

  it("selects kdniao when kdniao credentials are configured", () => {
    vi.stubEnv("SHIPPING_PROVIDER", "kdniao");
    vi.stubEnv("KDNIAO_EBUSINESS_ID", "demo-id");
    vi.stubEnv("KDNIAO_APP_KEY", "demo-key");

    const provider = getShippingProviderName();
    const mode = getShippingModeInfo(provider);

    expect(provider).toBe("kdniao");
    expect(mode).toMatchObject({ mode: "realtime", canAutoTrack: true, requiresManualConfirm: true });
    expect(mode.message).toContain("快递鸟");
  });

  it("uses kuaidi100 auto-detect when courier text cannot be mapped", async () => {
    vi.stubEnv("KUAIDI100_CUSTOMER", "demo-customer");
    vi.stubEnv("KUAIDI100_KEY", "demo-key");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("autoComNum")) {
        return Response.json({ auto: [{ comCode: "yuantong" }] });
      }
      return Response.json({ data: [{ ftime: "2026-07-02 12:00:00", context: "圆通速递已揽收" }] });
    });

    const provider = new Kuaidi100Provider();
    const events = await provider.refreshTracking("YT202607021802", { courier: "????" });

    expect(events[0].description).toContain("圆通速递已揽收");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRestore();
  });
});
