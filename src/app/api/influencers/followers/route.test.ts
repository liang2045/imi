import { describe, expect, it } from "vitest";
import { POST } from "./route";

const request = (body: unknown) => new Request("http://localhost/api/influencers/followers", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("influencer followers route", () => {
  it("本地模式保留 currentFollowers，不生成模拟粉丝数", async () => {
    const response = await POST(request({ platform: "小红书", handle: "@oil欧鸥", currentFollowers: 16000 }));
    const body = await response.json();
    expect(body.provider).toBe("mock");
    expect(body.followers).toBe(16000);
    expect(body.note).toContain("本地模式仅更新时间");
  });

  it("缺失 currentFollowers 时优先保留 followers，否则返回 0", async () => {
    const withFollowers = await POST(request({ platform: "抖音", handle: "test", followers: 23000 }));
    await expect(withFollowers.json()).resolves.toMatchObject({ followers: 23000 });

    const withoutFollowers = await POST(request({ platform: "B站", handle: "test" }));
    await expect(withoutFollowers.json()).resolves.toMatchObject({ followers: 0 });
  });
});
