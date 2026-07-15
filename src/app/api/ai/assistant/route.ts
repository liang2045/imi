import { NextResponse } from "next/server";
import { AiAssistantRequestSchema, buildLocalAssistantResponse } from "@/lib/ai-assistant";
import { getAiProviderConfig, requestSemanticDashboardAssistant } from "@/lib/ai-provider";
import { getCurrentUserFromCookie, isDingtalkConfigured } from "@/lib/auth/dingtalk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求数据不是有效 JSON" }, { status: 400 });
  }

  const parsed = AiAssistantRequestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "AI 助手请求格式不正确", details: parsed.error.flatten() }, { status: 400 });

  const fallback = buildLocalAssistantResponse(parsed.data.question, parsed.data.snapshot);
  const config = getAiProviderConfig();
  if (!config) {
    return NextResponse.json({ mode: "local", response: fallback, message: "当前使用本地数据助手。配置统一 AI 网关后将自动启用云端模型解读。" });
  }

  if (!isDingtalkConfigured()) {
    return NextResponse.json({ mode: "local", response: fallback, message: "云端 AI 需要已配置钉钉会话；当前已返回本地数据诊断。" });
  }
  const user = await getCurrentUserFromCookie();
  if (!user || user.status !== "active") {
    return NextResponse.json({ mode: "local", response: fallback, message: "请使用已启用的钉钉账号登录后使用云端 AI；当前已返回本地数据诊断。" });
  }

  try {
    const response = await requestSemanticDashboardAssistant(config, parsed.data.question, parsed.data.snapshot);
    console.info("ai_dashboard_assistant", { userId: user.id, role: user.role, month: parsed.data.snapshot.month, collaborationCount: parsed.data.snapshot.collaborationCount });
    return NextResponse.json({ mode: "cloud", response });
  } catch (error) {
    console.warn("ai_dashboard_assistant_failed", { userId: user.id, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ mode: "local", response: fallback, message: "云端 AI 暂时不可用，已返回本地数据诊断。" });
  }
}
