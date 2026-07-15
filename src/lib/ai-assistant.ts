import { z } from "zod";

const ProjectSchema = z.object({
  name: z.string(),
  budgetYuan: z.number().nonnegative(),
  rechargedYuan: z.number().nonnegative(),
  consumedYuan: z.number().nonnegative(),
  remainingRechargeYuan: z.number().nonnegative(),
});

const ShipmentSchema = z.object({ pending: z.number().int().nonnegative(), shipped: z.number().int().nonnegative(), signed: z.number().int().nonnegative() });

export const AiAssistantSnapshotSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  collaborationCount: z.number().int().nonnegative(),
  spendYuan: z.number().nonnegative(),
  budgetYuan: z.number().nonnegative(),
  budgetPercent: z.number().nonnegative(),
  averageYuan: z.number().nonnegative(),
  publishedCount: z.number().int().nonnegative(),
  pendingCount: z.number().int().nonnegative(),
  executionPercent: z.number().nonnegative(),
  statusCounts: z.array(z.object({ name: z.string(), value: z.number().int().nonnegative() })),
  projects: z.array(ProjectSchema),
  shipments: ShipmentSchema,
});

export type AiAssistantSnapshot = z.infer<typeof AiAssistantSnapshotSchema>;

export const AiAssistantRequestSchema = z.object({
  question: z.string().trim().min(2).max(800),
  snapshot: AiAssistantSnapshotSchema,
});

export const AiAssistantResponseSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  findings: z.array(z.object({ title: z.string().min(1).max(100), detail: z.string().min(1).max(500), level: z.enum(["good", "watch", "risk", "info"]) })).max(8),
  actions: z.array(z.string().min(1).max(300)).max(6),
  confidence: z.enum(["高", "中", "低"]),
});

export type AiAssistantResponse = z.infer<typeof AiAssistantResponseSchema>;

const yuan = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);

export function buildLocalAssistantResponse(question: string, snapshot: AiAssistantSnapshot): AiAssistantResponse {
  const mostConsumed = [...snapshot.projects].sort((a, b) => b.consumedYuan - a.consumedYuan)[0];
  const lowestRecharge = [...snapshot.projects].filter((project) => project.budgetYuan > 0).sort((a, b) => a.rechargedYuan / a.budgetYuan - b.rechargedYuan / b.budgetYuan)[0];
  const findings: AiAssistantResponse["findings"] = [
    {
      title: "合作执行",
      detail: `本月共有 ${snapshot.collaborationCount} 条合作，执行进度 ${snapshot.executionPercent}%，待跟进 ${snapshot.pendingCount} 条。`,
      level: snapshot.pendingCount > 8 ? "watch" : "good",
    },
    {
      title: "预算使用",
      detail: `达人费用 ${yuan(snapshot.spendYuan)}，占月度预算 ${snapshot.budgetPercent}%，当前均价 ${yuan(snapshot.averageYuan)}。`,
      level: snapshot.budgetPercent >= 90 ? "risk" : snapshot.budgetPercent >= 70 ? "watch" : "good",
    },
    {
      title: "样品物流",
      detail: `待寄出 ${snapshot.shipments.pending}，在寄 ${snapshot.shipments.shipped}，已签收 ${snapshot.shipments.signed}。`,
      level: snapshot.shipments.pending > 0 || snapshot.shipments.shipped > 0 ? "watch" : "good",
    },
  ];

  if (mostConsumed) findings.push({ title: "消耗最高项目", detail: `${mostConsumed.name} 已消耗 ${yuan(mostConsumed.consumedYuan)}，占项目预算 ${mostConsumed.budgetYuan ? Math.round(mostConsumed.consumedYuan / mostConsumed.budgetYuan * 100) : 0}%。`, level: "info" });
  if (lowestRecharge) findings.push({ title: "充值关注项", detail: `${lowestRecharge.name} 当前充值 ${yuan(lowestRecharge.rechargedYuan)}，剩余可充值 ${yuan(lowestRecharge.remainingRechargeYuan)}。`, level: lowestRecharge.rechargedYuan === 0 ? "watch" : "info" });

  const isReport = /报告|周报|月报|复盘/.test(question);
  const isShipping = /物流|快递|邮寄|签收/.test(question);
  const isBudget = /预算|充值|消耗|费用/.test(question);
  const title = isReport ? `${snapshot.month.replace("-", "年")}月 AI 管理报告` : isShipping ? "样品物流诊断" : isBudget ? "费用与充值诊断" : "本月合作数据诊断";
  const summary = isShipping
    ? `当前有 ${snapshot.shipments.pending + snapshot.shipments.shipped} 条样品尚未完成签收，建议优先处理待寄出和在寄记录。`
    : isBudget
      ? `本月达人费用预算使用率为 ${snapshot.budgetPercent}%，项目充值和消耗请以项目表的可充值余额为准。`
      : `基于 ${snapshot.month} 的合作、项目充值与邮寄台账生成；系统不会自动修改任何业务记录。`;
  const actions = [
    snapshot.pendingCount ? `优先跟进 ${snapshot.pendingCount} 条尚未完成的合作节点。` : "当前没有待跟进合作节点。",
    snapshot.shipments.pending ? `安排 ${snapshot.shipments.pending} 条待寄出样品的物流录入。` : "继续关注在寄样品的签收状态。",
    lowestRecharge ? `核对「${lowestRecharge.name}」的充值计划和余额。` : "按月补充项目充值台账。",
  ];

  return { title, summary, findings: findings.slice(0, 6), actions, confidence: "高" };
}
