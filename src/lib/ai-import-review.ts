import { z } from "zod";

export const aiTableTypes = ["influencers", "projectProgress", "shipping"] as const;
export const AiTableTypeSchema = z.enum(aiTableTypes);
export type AiTableType = z.infer<typeof AiTableTypeSchema>;
export type ImportCell = string | number;
export type ImportRow = Record<string, ImportCell>;

export const ImportReviewRequestSchema = z.object({
  tableType: AiTableTypeSchema,
  headers: z.array(z.string().trim().min(1)).min(1).max(80),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number()]))).min(1).max(1000),
});

export const ReviewIssueSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning", "info"]),
  row: z.number().int().nonnegative().optional(),
  column: z.string().optional(),
  message: z.string(),
  source: z.enum(["rule", "ai"]).default("rule"),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewFixSchema = z.object({
  id: z.string(),
  row: z.number().int().nonnegative(),
  column: z.string(),
  value: z.union([z.string(), z.number()]),
  label: z.string(),
});
export type ReviewFix = z.infer<typeof ReviewFixSchema>;

export const ImportReviewSchema = z.object({
  fieldMapping: z.record(z.string(), z.string()),
  issues: z.array(ReviewIssueSchema),
  fixes: z.array(ReviewFixSchema),
  summary: z.string(),
  semanticSummary: z.string().optional(),
});
export type ImportReview = z.infer<typeof ImportReviewSchema>;

const fields: Record<AiTableType, { id: string; label: string; required?: boolean; numeric?: boolean; aliases: string[] }[]> = {
  influencers: [
    { id: "name", label: "达人名称", required: true, aliases: ["达人", "达人名称", "名称", "姓名"] },
    { id: "accounts", label: "多平台账号", aliases: ["多平台账号", "账号详情", "平台账号", "账号明细", "账号"] },
    { id: "platform", label: "平台", aliases: ["平台"] },
    { id: "type", label: "达人类型", aliases: ["达人类型", "类型"] },
    { id: "city", label: "城市", aliases: ["城市", "地区", "省市"] },
    { id: "followers", label: "总粉丝", numeric: true, aliases: ["总粉丝", "总粉丝数", "粉丝", "粉丝数"] },
    { id: "quote", label: "参考报价（元）", numeric: true, aliases: ["参考报价", "报价", "报价元", "参考报价元"] },
    { id: "phone", label: "联系方式", aliases: ["联系方式", "电话", "手机号"] },
    { id: "tags", label: "标签", aliases: ["标签", "分类标签"] },
  ],
  projectProgress: [
    { id: "name", label: "项目", required: true, aliases: ["项目", "项目名称", "平台"] },
    { id: "budget", label: "充值预算", required: true, numeric: true, aliases: ["充值预算", "预算", "充值总预算", "月充值总预算"] },
    { id: "recharged", label: "已充值", required: true, numeric: true, aliases: ["已充值", "充值金额"] },
    { id: "consumed", label: "已消耗", required: true, numeric: true, aliases: ["已消耗", "消耗"] },
    { id: "remaining", label: "剩余可充值", numeric: true, aliases: ["剩余可充值", "剩余额度", "可充值金额"] },
  ],
  shipping: [
    { id: "influencer", label: "达人", required: true, aliases: ["达人", "达人名称", "收件人"] },
    { id: "sampleContent", label: "样品内容", aliases: ["样品内容", "产品名称", "物品内容"] },
    { id: "productCode", label: "产品编码", aliases: ["产品编码", "产品编号", "sku"] },
    { id: "quantity", label: "样品数量", required: true, numeric: true, aliases: ["样品数量", "数量", "产品数量"] },
    { id: "courier", label: "快递公司", required: true, aliases: ["快递公司", "物流公司", "承运商"] },
    { id: "trackingNo", label: "快递单号", required: true, aliases: ["快递单号", "运单号", "单号"] },
    { id: "shippingStatus", label: "物流状态", aliases: ["物流状态", "邮寄状态", "状态"] },
    { id: "owner", label: "负责人", aliases: ["负责人", "寄件人"] },
    { id: "note", label: "备注", aliases: ["备注", "说明"] },
  ],
};

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[\s()（）【】\[\]_-]/g, "").replace(/元|人民币|rmb/g, "");
}

function normalizeNumber(value: ImportCell) {
  const compact = String(value).replace(/[￥¥,，\s]/g, "").replace(/万$/, "0000");
  const number = Number(compact);
  return Number.isFinite(number) ? number : null;
}

function headerMapping(tableType: AiTableType, headers: string[]) {
  const mapped: Record<string, string> = {};
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    const found = fields[tableType].find((field) => field.aliases.some((alias) => normalizeHeader(alias) === normalized));
    if (found) mapped[header] = found.id;
  }
  return mapped;
}

function rowValue(row: ImportRow, mapping: Record<string, string>, fieldId: string) {
  const header = Object.entries(mapping).find(([, value]) => value === fieldId)?.[0];
  return header ? row[header] : undefined;
}

function displayRow(row: number) {
  return row + 2;
}

export function buildDeterministicImportReview(input: z.infer<typeof ImportReviewRequestSchema>): ImportReview {
  const mapping = headerMapping(input.tableType, input.headers);
  const issues: ReviewIssue[] = [];
  const fixes: ReviewFix[] = [];
  const ids = new Map<string, number>();

  for (const field of fields[input.tableType]) {
    if (field.required && !Object.values(mapping).includes(field.id)) {
      issues.push({ id: `missing-column-${field.id}`, severity: "error", column: field.label, message: `未识别必填列「${field.label}」`, source: "rule" });
    }
  }

  input.rows.forEach((row, rowIndex) => {
    for (const [column, raw] of Object.entries(row)) {
      const value = String(raw);
      if (value.trim().startsWith("=")) {
        issues.push({ id: `formula-${rowIndex}-${column}`, severity: "warning", row: rowIndex, column, message: `第 ${displayRow(rowIndex)} 行「${column}」包含公式，AI 仅按文本检查，不会执行公式`, source: "rule" });
      }
      if (typeof raw === "string" && raw !== raw.trim() && raw.trim()) {
        fixes.push({ id: `trim-${rowIndex}-${column}`, row: rowIndex, column, value: raw.trim(), label: `去除第 ${displayRow(rowIndex)} 行「${column}」首尾空格` });
      }
    }

    for (const field of fields[input.tableType]) {
      const value = rowValue(row, mapping, field.id);
      if (field.required && (!value || !String(value).trim())) {
        issues.push({ id: `missing-${rowIndex}-${field.id}`, severity: "error", row: rowIndex, column: field.label, message: `第 ${displayRow(rowIndex)} 行缺少「${field.label}」`, source: "rule" });
      }
      if (field.numeric && value !== undefined && String(value).trim()) {
        const parsed = normalizeNumber(value);
        if (parsed === null || parsed < 0) {
          issues.push({ id: `invalid-number-${rowIndex}-${field.id}`, severity: "error", row: rowIndex, column: field.label, message: `第 ${displayRow(rowIndex)} 行「${field.label}」不是有效的非负数字`, source: "rule" });
        } else if (String(value).trim() !== String(parsed)) {
          fixes.push({ id: `number-${rowIndex}-${field.id}`, row: rowIndex, column: Object.entries(mapping).find(([, id]) => id === field.id)?.[0] || field.label, value: parsed, label: `规范第 ${displayRow(rowIndex)} 行「${field.label}」数值格式` });
        }
      }
    }

    const duplicateValue = input.tableType === "influencers"
      ? String(rowValue(row, mapping, "accounts") || rowValue(row, mapping, "name") || "").trim().toLowerCase()
      : input.tableType === "projectProgress"
        ? String(rowValue(row, mapping, "name") || "").trim().toLowerCase()
        : String(rowValue(row, mapping, "trackingNo") || "").trim().toLowerCase();
    if (duplicateValue) {
      const previous = ids.get(duplicateValue);
      if (previous !== undefined) {
        issues.push({ id: `duplicate-${rowIndex}`, severity: "warning", row: rowIndex, message: `第 ${displayRow(rowIndex)} 行与第 ${displayRow(previous)} 行可能重复，请确认后再导入`, source: "rule" });
      } else ids.set(duplicateValue, rowIndex);
    }

    if (input.tableType === "influencers") {
      const platform = String(rowValue(row, mapping, "platform") || "").trim();
      if (platform && !["小红书", "抖音", "微博", "B站"].includes(platform)) {
        issues.push({ id: `platform-${rowIndex}`, severity: "warning", row: rowIndex, column: "平台", message: `第 ${displayRow(rowIndex)} 行的平台「${platform}」不是当前标准平台选项`, source: "rule" });
      }
    }
    if (input.tableType === "projectProgress") {
      const budget = normalizeNumber(rowValue(row, mapping, "budget") || "") || 0;
      const recharged = normalizeNumber(rowValue(row, mapping, "recharged") || "") || 0;
      const consumed = normalizeNumber(rowValue(row, mapping, "consumed") || "") || 0;
      const remaining = normalizeNumber(rowValue(row, mapping, "remaining") || "");
      if (budget && recharged > budget) issues.push({ id: `recharge-over-budget-${rowIndex}`, severity: "error", row: rowIndex, message: `第 ${displayRow(rowIndex)} 行已充值大于充值预算`, source: "rule" });
      if (budget && consumed > budget) issues.push({ id: `consume-over-budget-${rowIndex}`, severity: "warning", row: rowIndex, message: `第 ${displayRow(rowIndex)} 行已消耗大于充值预算，请确认金额口径`, source: "rule" });
      if (remaining !== null && budget && Math.abs(remaining - Math.max(0, budget - recharged)) > 0.01) issues.push({ id: `remaining-mismatch-${rowIndex}`, severity: "warning", row: rowIndex, message: `第 ${displayRow(rowIndex)} 行剩余可充值与预算减已充值不一致`, source: "rule" });
    }
    if (input.tableType === "shipping") {
      const trackingNo = String(rowValue(row, mapping, "trackingNo") || "").trim();
      if (trackingNo && trackingNo.length < 5) issues.push({ id: `tracking-short-${rowIndex}`, severity: "error", row: rowIndex, column: "快递单号", message: `第 ${displayRow(rowIndex)} 行快递单号少于 5 位`, source: "rule" });
      const quantity = normalizeNumber(rowValue(row, mapping, "quantity") || "");
      if (quantity !== null && quantity <= 0) issues.push({ id: `quantity-${rowIndex}`, severity: "error", row: rowIndex, column: "样品数量", message: `第 ${displayRow(rowIndex)} 行样品数量必须大于 0`, source: "rule" });
    }
  });

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  return { fieldMapping: mapping, issues, fixes, summary: `已检查 ${input.rows.length} 行：${errors} 个错误，${warnings} 个待确认项。` };
}

export const AiSemanticReviewSchema = z.object({
  semanticSummary: z.string().max(600).optional(),
  issues: z.array(z.object({
    severity: z.enum(["warning", "info"]),
    row: z.number().int().nonnegative().optional(),
    column: z.string().max(80).optional(),
    message: z.string().min(1).max(240),
  })).max(80).default([]),
  fieldMapping: z.record(z.string(), z.string()).optional(),
});

export function mergeSemanticReview(base: ImportReview, semantic: z.infer<typeof AiSemanticReviewSchema>, tableType: AiTableType) {
  const permittedIds = new Set(fields[tableType].map((field) => field.id));
  const modelMapping = Object.fromEntries(Object.entries(semantic.fieldMapping || {}).filter(([, fieldId]) => permittedIds.has(fieldId)));
  return {
    ...base,
    fieldMapping: { ...base.fieldMapping, ...modelMapping },
    semanticSummary: semantic.semanticSummary,
    issues: [...base.issues, ...semantic.issues.map((issue, index) => ({ ...issue, id: `ai-${index}`, source: "ai" as const }))],
  } satisfies ImportReview;
}

export function applyReviewFixes(rows: ImportRow[], fixes: ReviewFix[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  return rows.map((row, rowIndex) => {
    const next = { ...row };
    fixes.filter((fix) => fix.row === rowIndex && selected.has(fix.id)).forEach((fix) => { next[fix.column] = fix.value; });
    return next;
  });
}
