import type { Collaboration } from "./types";

const excludedFinanceKeywords = ["线下", "策划", "销售设计"];

export function isFinanceExcluded(item: Collaboration) {
  return excludedFinanceKeywords.some((keyword) => item.influencerName.includes(keyword) || item.owner.includes(keyword));
}

export function getAnalytics(items: Collaboration[], budgetCents: number, options: { averageCents?: number } = {}) {
  const financeItems = items.filter((item) => !isFinanceExcluded(item));
  const spendCents = financeItems.reduce((sum, item) => sum + item.feeCents, 0);
  const progressed = items.filter((item) => ["品牌最终审核中", "待达人发布", "笔记已发布", "合作延期", "合作已完成"].includes(item.status)).length;
  const executionTarget = Math.min(30, items.length);
  return {
    spendCents,
    averageCents: options.averageCents ?? (financeItems.length ? Math.round(spendCents / financeItems.length) : 0),
    budgetPercent: budgetCents ? Math.min(100, Math.round(spendCents / budgetCents * 100)) : 0,
    executionPercent: executionTarget ? Math.round(progressed / executionTarget * 100) : 0,
    progressed,
    executionTarget,
    completed: items.filter((item) => item.status === "合作已完成").length,
  };
}

export function groupCount<T extends object>(items: T[], key: keyof T) {
  return Object.entries(items.reduce<Record<string, number>>((acc, item) => {
    const value = String(item[key] ?? "未填写"); acc[value] = (acc[value] || 0) + 1; return acc;
  }, {})).map(([name, value]) => ({ name, value }));
}

export const money = (cents: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(cents / 100);
