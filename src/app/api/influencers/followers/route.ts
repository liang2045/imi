import { z } from "zod";

export const runtime = "nodejs";

const input = z.object({
  platform: z.enum(["小红书", "抖音", "微博", "B站"]),
  handle: z.string().trim().min(1),
  url: z.string().trim().optional(),
  currentFollowers: z.number().int().nonnegative().default(0),
  followers: z.number().int().nonnegative().optional(),
});

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "账号信息不完整", details: parsed.error.flatten() }, { status: 400 });
  }

  const base = parsed.data.currentFollowers || parsed.data.followers || 0;
  return Response.json({
    provider: "mock",
    followers: base,
    lastSyncedAt: new Date().toISOString(),
    note: "本地模式仅更新时间，不自动抓取真实粉丝。小红书/抖音/微博/B站粉丝实时数据需要官方或第三方数据服务授权后接入。",
  });
}
