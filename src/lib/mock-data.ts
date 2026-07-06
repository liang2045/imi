import type { AppState, CollaborationStatus, PaymentStatus, ShippingStatus } from "./types";

const statuses: CollaborationStatus[] = [
  "样品寄送中",
  "达人初稿脚本中",
  "初稿脚本审核中",
  "达人修改中",
  "品牌最终审核中",
  "待达人发布",
  "笔记已发布",
  "合作延期",
  "合作已完成",
];

const names = ["瓜瓜的衣橱", "Lin_official", "晚晚", "鹿小葵", "阿梨日记", "森野穿搭", "小桃气泡水", "Hana生活志", "丸子同学", "苏打日常", "Sisi在北京", "一只乔乔"];
const types = ["职场达人", "运动户外达人", "美妆达人", "生活方式达人"];
const cities = ["南京", "北京", "上海", "杭州", "成都", "广州"];
const platforms = ["小红书", "抖音", "微博", "B站"] as const;
const shippingStatuses: ShippingStatus[] = ["待寄出", "已寄出", "已签收"];
const paymentStatuses: PaymentStatus[] = ["未申请", "审批中", "已付款"];
const sampleContents = ["花再香氛礼盒", "再生花束套装", "干花挂饰组合", "花卡体验包", "节日限定花盒", "桌面小花瓶"];
const sampleProductCodes = ["HZ-FR-001", "HZ-BQ-002", "HZ-DR-003", "HZ-CD-004", "HZ-FB-005", "HZ-VS-006"];
const mayBrandMediaCollaborations = [
  { name: "小红书站外推广", feeCents: 49291800, plannedPublishDate: "2026-05-31" },
  { name: "抖音站外推广", feeCents: 66439200, plannedPublishDate: "2026-05-31" },
  { name: "B站站外推广", feeCents: 5841700, plannedPublishDate: "2026-05-31" },
  { name: "舆情处理", feeCents: 279200, plannedPublishDate: "2026-05-31" },
  { name: "供应商", feeCents: 6330900, plannedPublishDate: "2026-05-31" },
];
const mayProjectProgress = [
  { name: "小红书", budgetCents: 60000000, rechargedCents: 35000000, consumedCents: 49291800, remainingRechargeCents: 25000000 },
  { name: "抖音", budgetCents: 79000000, rechargedCents: 63000000, consumedCents: 66439200, remainingRechargeCents: 16000000 },
  { name: "B站", budgetCents: 17000000, rechargedCents: 7000000, consumedCents: 5841700, remainingRechargeCents: 10000000 },
  { name: "舆情处理", budgetCents: 500000, rechargedCents: 0, consumedCents: 279200, remainingRechargeCents: 500000 },
  { name: "供应商", budgetCents: 8500000, rechargedCents: 0, consumedCents: 6330900, remainingRechargeCents: 8500000 },
];
const earlyProjectProgress = mayProjectProgress.map((project) => ({
  ...project,
  rechargedCents: 0,
  consumedCents: 0,
  remainingRechargeCents: project.budgetCents,
}));
const julyProjectProgress = [
  { name: "小红书", budgetCents: 60000000, rechargedCents: 12000000, consumedCents: 8360000, remainingRechargeCents: 48000000 },
  { name: "抖音", budgetCents: 79000000, rechargedCents: 18000000, consumedCents: 11450000, remainingRechargeCents: 61000000 },
  { name: "B站", budgetCents: 17000000, rechargedCents: 3000000, consumedCents: 1680000, remainingRechargeCents: 14000000 },
  { name: "舆情处理", budgetCents: 500000, rechargedCents: 0, consumedCents: 80000, remainingRechargeCents: 500000 },
  { name: "供应商", budgetCents: 8500000, rechargedCents: 1000000, consumedCents: 620000, remainingRechargeCents: 7500000 },
];
const julySixDayCollaborations = Array.from({ length: 12 }, (_, i) => {
  const day = String(1 + Math.floor(i / 2)).padStart(2, "0");
  const shippingStatus = (["待寄出", "已寄出", "已签收"] as ShippingStatus[])[i % 3];
  const trackingNo = shippingStatus === "待寄出" ? undefined : `${i % 2 ? "SF" : "YT"}2026070${Math.floor(i / 2) + 1}${String(1800 + i).padStart(4, "0")}`;
  return {
    id: `july-demo-${i + 1}`,
    influencerId: `inf-${(i % names.length) + 1}`,
    influencerName: names[i % names.length],
    month: "2026-07",
    status: statuses[(i + 1) % statuses.length],
    shippingStatus,
    paymentStatus: paymentStatuses[i % paymentStatuses.length],
    owner: i % 2 ? "林琪" : "梁管理员",
    feeCents: 168000 + (i % 6) * 42000,
    plannedPublishDate: `2026-07-${day}`,
    sampleContent: sampleContents[i % sampleContents.length],
    sampleQuantity: 1 + (i % 3),
    sampleProductCode: sampleProductCodes[i % sampleProductCodes.length],
    trackingNo,
    courier: trackingNo?.startsWith("SF") ? "顺丰速运" : trackingNo ? "圆通速递" : undefined,
    shippedAt: trackingNo ? `2026-07-${day} 10:${String(10 + i).padStart(2, "0")}` : undefined,
    trackingMode: trackingNo ? "manual" as const : undefined,
    trackingUpdatedAt: trackingNo ? `2026-07-${day}T11:${String(10 + i).padStart(2, "0")}:00.000+08:00` : undefined,
    shipmentEvents: trackingNo ? [
      { time: `2026-07-${day} 11:${String(10 + i).padStart(2, "0")}`, description: `已保存物流信息：${trackingNo.startsWith("SF") ? "顺丰速运" : "圆通速递"} ${trackingNo}` },
      { time: `2026-07-${day} 11:${String(10 + i).padStart(2, "0")}`, description: shippingStatus === "已签收" ? "已人工确认签收" : "本地手工模式不自动查询真实物流轨迹，请人工维护或配置快递100。" },
    ] : undefined,
    cooperationIntent: (["达人明确拒绝", "达人OK", "微信沟通/测品中"] as const)[i % 3],
    influencerRejectReason: i % 3 === 0 ? ["报价偏高", "档期冲突", "内容方向不匹配", "暂不接急单"][i % 4] : undefined,
    brandResult: (["品牌通过", "达人已拒", "品牌/客户审核中", "品牌/客户拒绝"] as const)[i % 4],
    brandRejectReason: i % 4 === 3 ? ["风格/调性不符", "内容质量一般", "数据表现偏弱"][i % 3] : undefined,
  };
});

export const initialState: AppState = {
  budgetCents: 8000000,
  monthlyFinance: {
    "2026-01": { budgetCents: 165000000, averageCents: 229500, projectProgress: earlyProjectProgress },
    "2026-02": { budgetCents: 165000000, averageCents: 229500, projectProgress: earlyProjectProgress },
    "2026-03": { budgetCents: 165000000, averageCents: 229500, projectProgress: earlyProjectProgress },
    "2026-04": { budgetCents: 165000000, averageCents: 229500, projectProgress: mayProjectProgress },
    "2026-05": { budgetCents: 165000000, averageCents: 229500, projectProgress: mayProjectProgress },
    "2026-06": { budgetCents: 165000000, averageCents: 229500, projectProgress: mayProjectProgress },
    "2026-07": { budgetCents: 165000000, averageCents: 229500, projectProgress: julyProjectProgress },
  },
  currentUser: { name: "梁管理员", role: "admin" },
  influencers: names.map((name, i) => ({
    id: `inf-${i + 1}`,
    name,
    handle: `@${name.replaceAll(" ", "_")}`,
    platform: platforms[i % platforms.length],
    platformAccounts: [
      {
        id: `acc-${i + 1}-primary`,
        platform: platforms[i % platforms.length],
        handle: `@${name.replaceAll(" ", "_")}`,
        url: `https://www.baidu.com/s?wd=${encodeURIComponent(`${platforms[i % platforms.length]} ${name}`)}`,
        followers: 18000 + i * 7300,
      },
      ...(i % 3 === 0
        ? [
            {
              id: `acc-${i + 1}-douyin`,
              platform: "抖音" as const,
              handle: `${name}_dy`,
              url: `https://www.baidu.com/s?wd=${encodeURIComponent(`抖音 ${name}`)}`,
              followers: 9200 + i * 3600,
            },
          ]
        : []),
    ],
    type: types[i % types.length],
    city: cities[i % cities.length],
    followers: 18000 + i * 7300,
    quoteCents: 168000 + (i % 5) * 47000,
    phone: `138****${String(1200 + i).slice(-4)}`,
    tags: [types[i % types.length], i % 2 ? "高配合度" : "内容稳定"],
  })),
  collaborations: [
    ...julySixDayCollaborations,
    ...Array.from({ length: 33 }, (_, i) => {
    const trackingNo = i % 3 ? `SF${202606180000 + i}` : undefined;
    const shippingStatus = shippingStatuses[i % shippingStatuses.length];
    return {
      id: `col-${i + 1}`,
      influencerId: `inf-${(i % names.length) + 1}`,
      influencerName: names[i % names.length],
      month: "2026-06",
      status: statuses[i % statuses.length],
      shippingStatus,
      paymentStatus: paymentStatuses[i % paymentStatuses.length],
      owner: i % 2 ? "林琪" : "梁管理员",
      feeCents: 124333 + (i % 8) * 31000 + (i === 0 ? 11 : 0),
      plannedPublishDate: `2026-06-${String(8 + (i % 21)).padStart(2, "0")}`,
      sampleContent: sampleContents[i % sampleContents.length],
      sampleQuantity: 1 + (i % 3),
      sampleProductCode: sampleProductCodes[i % sampleProductCodes.length],
      trackingNo,
      courier: trackingNo ? "顺丰速运" : undefined,
      shippedAt: trackingNo ? `2026-06-${String(10 + (i % 12)).padStart(2, "0")} 10:00` : undefined,
      trackingMode: trackingNo ? "manual" as const : undefined,
      trackingUpdatedAt: trackingNo ? "2026-06-18T10:20:00.000+08:00" : undefined,
      shipmentEvents: trackingNo ? [
        { time: "2026-06-18 10:20", description: `已保存物流信息：顺丰速运 ${trackingNo}` },
        { time: "2026-06-18 10:20", description: shippingStatus === "已签收" ? "已人工确认签收" : "本地手工模式不自动查询真实物流轨迹，请人工维护或配置快递100。" },
      ] : undefined,
      cooperationIntent: (["达人明确拒绝", "达人OK", "微信沟通/测品中"] as const)[i % 3],
      influencerRejectReason: i % 3 === 0 ? ["无合作意向", "档期满了/不接急单", "觉得产品不合适", "竞品排期冲突"][i % 4] : undefined,
      brandResult: (["品牌通过", "达人已拒", "品牌/客户审核中", "品牌/客户拒绝"] as const)[i % 4],
      brandRejectReason: i % 4 === 3 ? ["内容质量一般", "风格/调性不符", "品牌策略调整"][i % 3] : undefined,
    };
    }),
    ...mayBrandMediaCollaborations.map((item, i) => ({
      id: `may-brand-media-${i + 1}`,
      influencerId: `may-brand-media-${i + 1}`,
      influencerName: item.name,
      month: "2026-05",
      status: "合作已完成" as CollaborationStatus,
      shippingStatus: "已签收" as ShippingStatus,
      paymentStatus: "已付款" as PaymentStatus,
      owner: "品牌部媒介组",
      feeCents: item.feeCents,
      plannedPublishDate: item.plannedPublishDate,
      sampleContent: "站外推广费用",
      sampleQuantity: 1,
      sampleProductCode: "MEDIA-OFFSITE",
      cooperationIntent: "达人OK" as const,
      brandResult: "品牌通过" as const,
    })),
  ],
};
