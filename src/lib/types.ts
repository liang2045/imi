export type Role = "admin" | "member";
export type PlatformName = "小红书" | "抖音" | "微博" | "B站";

export type CollaborationStatus =
  | "样品寄送中"
  | "达人初稿脚本中"
  | "初稿脚本审核中"
  | "达人修改中"
  | "品牌最终审核中"
  | "待达人发布"
  | "笔记已发布"
  | "合作延期"
  | "合作已完成";

export type ShippingStatus = "待寄出" | "已寄出" | "已签收";
export type TransitStatus = "在途" | "异常" | "已签收";
export type PaymentStatus = "未申请" | "审批中" | "已付款";

export interface ShipmentEvent {
  time: string;
  description: string;
}

export interface PlatformAccount {
  id: string;
  platform: PlatformName;
  handle: string;
  url: string;
  followers: number;
  lastSyncedAt?: string;
}

export interface Influencer {
  id: string;
  name: string;
  handle: string;
  platform: PlatformName;
  platformAccounts?: PlatformAccount[];
  type: string;
  city: string;
  followers: number;
  quoteCents: number;
  phone: string;
  tags: string[];
  notes?: string;
}

export interface Collaboration {
  id: string;
  influencerId: string;
  influencerName: string;
  month: string;
  status: CollaborationStatus;
  shippingStatus: ShippingStatus;
  paymentStatus: PaymentStatus;
  owner: string;
  feeCents: number;
  plannedPublishDate: string;
  trackingNo?: string;
  courier?: string;
  shippingPhone?: string;
  transitStatus?: TransitStatus;
  trackingMode?: "manual" | "realtime";
  trackingUpdatedAt?: string;
  estimatedArrivalAt?: string;
  sampleContent?: string;
  sampleQuantity?: number;
  sampleProductCode?: string;
  shippedAt?: string;
  shippingNote?: string;
  shipmentEvents?: ShipmentEvent[];
  cooperationIntent: "达人明确拒绝" | "达人OK" | "微信沟通/测品中";
  influencerRejectReason?: string;
  brandResult: "品牌通过" | "达人已拒" | "品牌/客户审核中" | "品牌/客户拒绝";
  brandRejectReason?: string;
}

export interface MonthlyProjectFinance {
  name: string;
  budgetCents: number;
  rechargedCents: number;
  consumedCents: number;
  remainingRechargeCents: number;
}

export interface MonthlyFinanceConfig {
  budgetCents?: number;
  averageCents?: number;
  projectProgress?: MonthlyProjectFinance[];
}

export interface AppState {
  influencers: Influencer[];
  collaborations: Collaboration[];
  budgetCents: number;
  monthlyFinance?: Record<string, MonthlyFinanceConfig>;
  settings?: {
    exportDirectory?: string;
    resourceLibrarySync?: {
      path: string;
      mtimeMs?: number;
      signature?: string;
    };
    projectProgressSync?: Record<string, {
      path: string;
      mtimeMs?: number;
      signature?: string;
    }>;
  };
  currentUser: { name: string; role: Role };
}
