import { NextResponse } from "next/server";
import { buildDeterministicImportReview, ImportReviewRequestSchema, mergeSemanticReview } from "@/lib/ai-import-review";
import { getAiProviderConfig, getAiRequestLimits, requestSemanticImportReview } from "@/lib/ai-provider";
import { getCurrentUserFromCookie, isDingtalkConfigured } from "@/lib/auth/dingtalk";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "请求数据不是有效 JSON" }, { status: 400 });
  }
  const parsed = ImportReviewRequestSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "表格数据格式不正确", details: parsed.error.flatten() }, { status: 400 });

  const limits = getAiRequestLimits();
  const bytes = Buffer.byteLength(JSON.stringify(parsed.data), "utf8");
  if (parsed.data.rows.length > limits.maxRows || bytes > limits.maxBytes) {
    return NextResponse.json({ error: `单次 AI 校验最多 ${limits.maxRows} 行、${Math.floor(limits.maxBytes / 1024)} KB，请拆分表格后重试。` }, { status: 413 });
  }

  const review = buildDeterministicImportReview(parsed.data);
  const config = getAiProviderConfig();
  if (!config) {
    return NextResponse.json({ enabled: false, semanticReviewed: false, review, message: "统一 AI 网关尚未配置，已完成本地规则校验；配置 AI_ENABLED、AI_BASE_URL、AI_API_KEY、AI_MODEL 后可启用语义校验。" });
  }

  if (!isDingtalkConfigured()) {
    return NextResponse.json({ error: "AI 网关要求启用钉钉登录，当前本地演示模式不能发送业务数据到云端。" }, { status: 403 });
  }
  const user = await getCurrentUserFromCookie();
  if (!user || user.status !== "active") return NextResponse.json({ error: "请使用已启用的钉钉账号登录后再使用 AI 校验。" }, { status: 401 });

  try {
    const semantic = await requestSemanticImportReview(config, parsed.data.tableType, parsed.data.headers, parsed.data.rows);
    const merged = mergeSemanticReview(review, semantic, parsed.data.tableType);
    console.info("ai_import_review", { userId: user.id, role: user.role, tableType: parsed.data.tableType, rows: parsed.data.rows.length, issues: merged.issues.length });
    return NextResponse.json({ enabled: true, semanticReviewed: true, review: merged });
  } catch (error) {
    console.warn("ai_import_review_failed", { userId: user.id, tableType: parsed.data.tableType, message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ enabled: true, semanticReviewed: false, review, message: "AI 语义校验暂时不可用，已保留本地规则校验结果；未修改任何数据。" });
  }
}
