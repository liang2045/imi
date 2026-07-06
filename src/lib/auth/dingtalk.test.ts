import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, type SessionUser } from "./dingtalk";

const user: SessionUser = {
  id: "union-1",
  dingtalkUnionId: "union-1",
  dingtalkUserId: "user-1",
  name: "测试用户",
  role: "admin",
  status: "active",
};

describe("dingtalk session", () => {
  it("encodes and decodes a signed session", () => {
    const token = encodeSession(user, "test-secret-at-least-32-bytes");
    expect(decodeSession(token, "test-secret-at-least-32-bytes")).toMatchObject({
      dingtalkUnionId: "union-1",
      role: "admin",
      status: "active",
    });
  });

  it("rejects tampered or invalid sessions", () => {
    const token = encodeSession(user, "test-secret-at-least-32-bytes");
    expect(decodeSession(`${token}x`, "test-secret-at-least-32-bytes")).toBeNull();
    expect(decodeSession(token, "another-secret-at-least-32-bytes")).toBeNull();
    expect(decodeSession(undefined, "test-secret-at-least-32-bytes")).toBeNull();
  });
});
