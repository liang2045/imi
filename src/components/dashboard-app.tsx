"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import ExcelJS from "exceljs";
import {
  IconAddressBook,
  IconBrandCampaignmonitor,
  IconCalendarMonth,
  IconChartPie,
  IconChevronLeft,
  IconChevronRight,
  IconCirclePlus,
  IconDatabase,
  IconDashboard,
  IconDownload,
  IconExternalLink,
  IconFileAnalytics,
  IconMenu2,
  IconPencil,
  IconRefresh,
  IconSearch,
  IconSettings,
  IconTrash,
  IconTruckDelivery,
  IconUpload,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { initialState } from "@/lib/mock-data";
import type { AppState, Collaboration, CollaborationStatus, Influencer, MonthlyProjectFinance, PaymentStatus, PlatformAccount, ShipmentEvent, ShippingStatus, TransitStatus } from "@/lib/types";
import { getAnalytics, groupCount, money } from "@/lib/analytics";
import { inferProvinceByCity, provinceCities } from "@/lib/china-regions";
import { detectCourierByTrackingNo } from "@/lib/courier-detect";
import { ensureMonthFinance, getAvailableMonths, getCurrentMonthValue } from "@/lib/months";
import { hasOnlyManualSignedPrompt, hasSignedEvent } from "@/lib/shipping-status";
import { BarChart, PieChart } from "./charts";

type View = "overview" | "influencers" | "creatorDatabase" | "calendar" | "shipping" | "shippingSummary" | "monthly" | "analytics" | "team";
type DrilldownField = "paymentStatus" | "cooperationIntent" | "influencerRejectReason" | "brandResult" | "brandRejectReason";
type DrilldownFilter = { field: DrilldownField; value: string; title: string };
type CreatorDatabaseSortKey = "name" | "platform" | "city" | "status" | "paymentStatus" | "intent" | "brandResult" | "rejectReason" | "owner" | "fee";
type SortDirection = "asc" | "desc";
type CreatorDatabaseSort = { key: CreatorDatabaseSortKey; direction: SortDirection };
type ShippingApiResponse = {
  provider?: "mock" | "kuaidi100" | "kdniao";
  mode?: "manual" | "realtime";
  canAutoTrack?: boolean;
  requiresManualConfirm?: boolean;
  message?: string;
  providerMessage?: string;
  events?: ShipmentEvent[];
};

const STORAGE_KEY = "creator-ops-state-v2";
const statusOrder: CollaborationStatus[] = ["样品寄送中", "达人初稿脚本中", "初稿脚本审核中", "达人修改中", "品牌最终审核中", "待达人发布", "笔记已发布", "合作延期", "合作已完成"];
const nav: { id: View; label: string; icon: typeof IconDashboard }[] = [
  { id: "overview", label: "达人管理总视图", icon: IconDashboard },
  { id: "influencers", label: "达人管理资源库", icon: IconAddressBook },
  { id: "creatorDatabase", label: "达人数据库", icon: IconDatabase },
  { id: "calendar", label: "达人档期日历", icon: IconCalendarMonth },
  { id: "shipping", label: "样品邮寄情况", icon: IconTruckDelivery },
  { id: "shippingSummary", label: "全年样品汇总", icon: IconFileAnalytics },
  { id: "monthly", label: "每月达人合作详情", icon: IconChartPie },
  { id: "analytics", label: "达人建联情况分析", icon: IconFileAnalytics },
  { id: "team", label: "团队与权限", icon: IconUsers },
];
const metricTone = [
  "bg-[#F29A57]",
  "bg-[#7C6CEF]",
  "bg-[#A38CF5]",
  "bg-[#8C93A3]",
];
const tagTone = ["tag-violet", "tag-blue", "tag-rose", "tag-cyan", "tag-teal"];
const platforms = ["小红书", "抖音", "微博", "B站"] as const;
const paymentStatusOptions: PaymentStatus[] = ["未申请", "审批中", "已付款"];
const shippingStatusOptions: ShippingStatus[] = ["待寄出", "已寄出", "已签收"];
const cooperationIntentOptions: Collaboration["cooperationIntent"][] = ["达人明确拒绝", "达人OK", "微信沟通/测品中"];
const brandResultOptions: Collaboration["brandResult"][] = ["品牌通过", "达人已拒", "品牌/客户审核中", "品牌/客户拒绝"];
const influencerTypes = ["美妆达人", "穿搭达人", "生活方式达人", "职场达人", "母婴达人", "运动户外达人", "美食达人", "家居达人", "旅行达人", "数码达人", "知识科普达人", "校园达人", "探店达人", "剧情达人", "测评达人"];
const tagGroups = [
  { title: "内容", options: ["内容稳定", "内容高级", "审美好", "脚本能力强", "出片快", "种草力强"] },
  { title: "配合度", options: ["高配合度", "回复快", "改稿配合", "可长期合作", "档期稳定", "沟通顺畅"] },
  { title: "评估", options: ["性价比高", "转化潜力", "报价偏高", "需复盘", "优先合作", "观察名单"] },
];

function toneFor(text: string) {
  let sum = 0;
  for (const char of text) sum += char.charCodeAt(0);
  return tagTone[sum % tagTone.length];
}

function platformTagClass(platform: PlatformAccount["platform"]) {
  if (platform === platforms[0]) return "tag-platform-xhs";
  if (platform === platforms[1]) return "tag-platform-douyin";
  if (platform === platforms[2]) return "tag-platform-weibo";
  if (platform === platforms[3]) return "tag-platform-bilibili";
  return toneFor(platform);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}年${Number(month)}月`;
}

function getMonthBudgetCents(state: AppState, month: string) {
  return state.monthlyFinance?.[month]?.budgetCents ?? state.budgetCents;
}

function getMonthAverageCents(state: AppState, month: string) {
  return state.monthlyFinance?.[month]?.averageCents;
}

function getMonthProjectProgress(state: AppState, month: string) {
  return state.monthlyFinance?.[month]?.projectProgress || [];
}

function getYearProjectProgress(state: AppState, year: string) {
  const months = Object.entries(state.monthlyFinance || {})
    .filter(([month]) => month.startsWith(`${year}-`))
    .sort(([a], [b]) => a.localeCompare(b));
  const projects = months.reduce((map, [, config]) => {
    (config.projectProgress || []).forEach((project) => {
      const current = map.get(project.name) || { name: project.name, budgetCents: 0, rechargedCents: 0, consumedCents: 0, remainingRechargeCents: 0 };
      current.budgetCents += project.budgetCents;
      current.rechargedCents += project.rechargedCents;
      current.consumedCents += project.consumedCents;
      current.remainingRechargeCents += project.remainingRechargeCents;
      map.set(project.name, current);
    });
    return map;
  }, new Map<string, MonthlyProjectFinance>());
  return { months: months.map(([month]) => month), projects: Array.from(projects.values()) };
}

function saveMonthProjectProgress(state: AppState, month: string, projects: MonthlyProjectFinance[]): AppState {
  const normalized = normalizeProjectRows(projects);
  const budgetCents = normalized.reduce((sum, project) => sum + project.budgetCents, 0);
  return {
    ...state,
    monthlyFinance: {
      ...state.monthlyFinance,
      [month]: {
        ...state.monthlyFinance?.[month],
        budgetCents,
        projectProgress: normalized,
      },
    },
  };
}

function downloadWorkbookBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function bufferToBase64(buffer: ExcelJS.Buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer as ArrayBuffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function exportWorkbookBuffer(buffer: ExcelJS.Buffer, filename: string, exportDirectory?: string) {
  const directory = exportDirectory?.trim();
  if (!directory) {
    downloadWorkbookBuffer(buffer, filename);
    return { mode: "download" as const, path: "", mtimeMs: undefined };
  }
  const response = await fetch("/api/export-file", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ directory, filename, contentBase64: bufferToBase64(buffer) }),
  });
  const payload = (await response.json()) as { path?: string; mtimeMs?: number; error?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || "保存导出文件失败");
  return { mode: "saved" as const, path: payload.path || "", mtimeMs: payload.mtimeMs };
}

async function syncResourceLibraryFile(action: "stat" | "read" | "readRows" | "write", filePath: string, contentBase64?: string) {
  const response = await fetch("/api/resource-library-sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, path: filePath, contentBase64 }),
  });
  const payload = (await response.json()) as { rows?: Record<string, string | number>[]; rawRows?: string[][]; mtimeMs?: number; error?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || "同步文件失败");
  return payload;
}

function mergeMonthlyFinance(saved: AppState["monthlyFinance"]) {
  const months = new Set([...Object.keys(initialState.monthlyFinance || {}), ...Object.keys(saved || {})]);
  return Array.from(months).reduce<AppState["monthlyFinance"]>((acc, month) => {
    const savedProjects = saved?.[month]?.projectProgress;
    const initialProjects = initialState.monthlyFinance?.[month]?.projectProgress;
    const savedLooksEmpty = Boolean(savedProjects?.length) && savedProjects!.every((project) => project.rechargedCents === 0 && project.consumedCents === 0);
    acc![month] = {
      ...initialState.monthlyFinance?.[month],
      ...saved?.[month],
      projectProgress: month === "2026-07" && savedLooksEmpty && initialProjects?.length ? initialProjects : savedProjects || initialProjects,
    };
    return acc;
  }, {});
}

function hydrateCollaborationSample(item: Collaboration, index: number): Collaboration {
  const fallback = initialState.collaborations.find((current) => current.id === item.id);
  return {
    ...item,
    sampleContent: item.sampleContent || fallback?.sampleContent || ["花再香氛礼盒", "再生花束套装", "干花挂饰组合", "花卡体验包"][index % 4],
    sampleQuantity: item.sampleQuantity || fallback?.sampleQuantity || 1,
    sampleProductCode: item.sampleProductCode || fallback?.sampleProductCode || `HZ-SAMPLE-${String((index % 99) + 1).padStart(3, "0")}`,
  };
}

function cleanLegacyMockShipping(item: Collaboration): Collaboration {
  if (item.shippingStatus === "待寄出") return item;
  const descriptions = item.shipmentEvents?.map((event) => event.description).join(" ") || "";
  const legacyMock = /已签收，签收人：本人|快件运输中|快件到达分拨中心|派送中|预计 2-3 天内送达|物流异常：地址信息需人工确认/.test(descriptions);
  const manualPromptOnlySigned = item.shippingStatus === "已签收" && item.trackingMode === "manual" && hasOnlyManualSignedPrompt(item.shipmentEvents);
  if (!legacyMock && !manualPromptOnlySigned) return item;
  const demoteSigned = item.shippingStatus === "已签收" && (descriptions.includes("已签收，签收人：本人") || manualPromptOnlySigned);
  return {
    ...item,
    status: demoteSigned ? "样品寄送中" : item.status,
    shippingStatus: demoteSigned ? "已寄出" : item.shippingStatus,
    transitStatus: undefined,
    trackingMode: "manual",
    estimatedArrivalAt: undefined,
    shipmentEvents: item.trackingNo
        ? [
            { time: item.shippedAt || new Date().toLocaleString("zh-CN", { hour12: false }), description: `已保存物流信息：${item.courier || "快递公司"} ${item.trackingNo}` },
            { time: item.shippedAt || new Date().toLocaleString("zh-CN", { hour12: false }), description: "历史模拟或提示型签收轨迹已清理；当前为本地手工物流模式，请人工维护。" },
          ]
        : undefined,
  };
}

function hydrateSavedState(saved: AppState): AppState {
  const savedIds = new Set(saved.collaborations.map((item) => item.id));
  const savedHasJulyBusiness = saved.collaborations.some((item) => item.month === "2026-07" && !item.id.startsWith("july-demo-"));
  const missingCollaborations = initialState.collaborations.filter((item) => !savedIds.has(item.id) && (!item.id.startsWith("july-demo-") || !savedHasJulyBusiness));
  return ensureMonthFinance({
    ...saved,
    monthlyFinance: mergeMonthlyFinance(saved.monthlyFinance),
    collaborations: [...saved.collaborations, ...missingCollaborations].map(hydrateCollaborationSample).map(cleanLegacyMockShipping),
  });
}

function normalizeShippingCollaboration(item: Collaboration): Collaboration {
  if (item.shippingStatus === "待寄出") {
    return { ...item, status: "样品寄送中", trackingNo: undefined, courier: undefined, shippedAt: undefined, shipmentEvents: undefined };
  }
  if (item.shippingStatus === "已寄出" && ["待达人发布", "笔记已发布", "合作已完成"].includes(item.status)) {
    return { ...item, status: "样品寄送中" };
  }
  if (item.shippingStatus === "已签收" && item.status === "样品寄送中") {
    return { ...item, status: "达人初稿脚本中" };
  }
  return item;
}

function hasExceptionEvent(events?: ShipmentEvent[]) {
  return events?.some((event) => /异常|滞留|拒收|退回|失败|问题|破损/.test(event.description)) || false;
}

function estimateArrivalText(base?: string) {
  const date = base ? new Date(base.replace(" ", "T")) : new Date();
  if (Number.isNaN(date.getTime())) date.setTime(Date.now());
  date.setDate(date.getDate() + 3);
  return date.toLocaleString("zh-CN", { hour12: false, month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatShippingFailureMessage(message: string) {
  if (/未识别该单号|找不到对应公司|暂无轨迹|参数错误|单号/.test(message)) {
    return "快递100真实接口已启用，但当前单号没有查到可用轨迹。请确认这是已揽收的真实快递单号，并检查快递公司是否正确；顺丰、中通等快递可能需要填写手机号后四位。";
  }
  return message;
}

function buildShippingProductSummary(items: Collaboration[]) {
  const shipped = items.filter((item) => item.shippingStatus !== "待寄出");
  const rows = Array.from(shipped.reduce((map, item) => {
    const code = item.sampleProductCode?.trim() || "未填写编码";
    const current = map.get(code) || { code, content: item.sampleContent || "未填写样品", shipments: 0, quantity: 0, signed: 0, inTransit: 0, exception: 0, trackingNos: [] as string[], senders: [] as string[] };
    current.shipments += 1;
    current.quantity += item.sampleQuantity || 1;
    current.signed += item.shippingStatus === "已签收" ? 1 : 0;
    current.inTransit += item.shippingStatus === "已寄出" && transitStatusFor(item) === "在途" ? 1 : 0;
    current.exception += transitStatusFor(item) === "异常" ? 1 : 0;
    if (item.trackingNo) current.trackingNos.push(item.trackingNo);
    if (item.owner && !current.senders.includes(item.owner)) current.senders.push(item.owner);
    map.set(code, current);
    return map;
  }, new Map<string, { code: string; content: string; shipments: number; quantity: number; signed: number; inTransit: number; exception: number; trackingNos: string[]; senders: string[] }>()).values());
  return {
    shipped,
    rows,
    totalShipments: shipped.length,
    totalQuantity: shipped.reduce((sum, item) => sum + (item.sampleQuantity || 1), 0),
    sampleKinds: new Set(shipped.map((item) => item.sampleContent || "未填写样品")).size,
    productCodeCount: new Set(shipped.map((item) => item.sampleProductCode || "未填写编码")).size,
  };
}

function transitStatusFor(item: Collaboration): TransitStatus | null {
  if (item.shippingStatus === "已签收") return "已签收";
  if (item.shippingStatus !== "已寄出") return null;
  if (hasSignedEvent(item.shipmentEvents)) return "已签收";
  if (item.transitStatus === "异常" || hasExceptionEvent(item.shipmentEvents)) return "异常";
  if (item.transitStatus === "在途") return "在途";
  return null;
}

export function DashboardApp() {
  const [currentMonth] = useState(() => getCurrentMonthValue());
  const [state, setState] = useState<AppState>(() => ensureMonthFinance(initialState, currentMonth));
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<View>("monthly");
  const [month, setMonth] = useState(currentMonth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drilldownFilter, setDrilldownFilter] = useState<DrilldownFilter | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const timer = window.setTimeout(() => {
      if (saved) {
        try {
          const hydrated = hydrateSavedState(JSON.parse(saved));
          setState(hydrated);
          setMonth((selectedMonth) => getAvailableMonths(hydrated, selectedMonth).includes(selectedMonth) ? selectedMonth : currentMonth);
        } catch {
          setState(ensureMonthFinance(initialState, currentMonth));
          setMonth(currentMonth);
        }
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentMonth]);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, loaded]);

  const resetLocalData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(ensureMonthFinance(initialState, currentMonth));
    setMonth(currentMonth);
  };

  const openCreatorDatabase = (filter: DrilldownFilter) => {
    setDrilldownFilter(filter);
    setView("creatorDatabase");
    setSidebarOpen(false);
  };

  const content =
    view === "overview" ? <Overview state={state} setState={setState} month={month} onDrilldown={openCreatorDatabase} /> :
    view === "influencers" ? <Influencers state={state} setState={setState} onAdd={() => setShowAdd(true)} /> :
    view === "creatorDatabase" ? <CreatorDatabase state={state} month={month} filter={drilldownFilter} onClearFilter={() => setDrilldownFilter(null)} /> :
    view === "calendar" ? <Calendar state={state} month={month} /> :
    view === "shipping" ? <Shipping state={state} setState={setState} month={month} /> :
    view === "shippingSummary" ? <ShippingSummaryPage state={state} month={month} /> :
    view === "monthly" ? <Monthly state={state} setState={setState} month={month} /> :
    view === "analytics" ? <Analytics state={state} month={month} onDrilldown={openCreatorDatabase} /> :
    <Team state={state} />;
  const monthOptions = getAvailableMonths(state, month);

  return (
    <div className="dashboard-shell min-h-screen bg-[#f5f5f7]">
      <aside className={`dashboard-sidebar fixed inset-y-0 left-0 z-40 bg-[#30313a] text-white transition-all duration-200 ${collapsed ? "is-collapsed w-[82px]" : "is-expanded w-[286px]"} ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef0f2] text-[#30313a]"><IconBrandCampaignmonitor size={23} /></div>
          {!collapsed && <div className="min-w-0"><div className="truncate text-base font-semibold">imi达人管理</div><div className="text-xs text-[#c8cbd1]">IMI CREATOR OPS</div></div>}
          <button className="ml-auto hidden text-[#c8cbd1] md:block" onClick={() => setCollapsed(!collapsed)} aria-label="折叠侧栏">{collapsed ? <IconChevronRight /> : <IconChevronLeft />}</button>
          <button className="ml-auto md:hidden" onClick={() => setSidebarOpen(false)} aria-label="关闭导航"><IconX /></button>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => <button key={item.id} title={item.label} onClick={() => { if (item.id === "creatorDatabase") setDrilldownFilter(null); setView(item.id); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${view === item.id ? "bg-[#eef0f2] text-[#30313a]" : "text-[#d8dbe0] hover:bg-white/10"}`}><item.icon size={21} />{!collapsed && item.label}</button>)}
        </nav>
        <div className="absolute inset-x-3 bottom-4 border-t border-white/10 pt-4">
          <div className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#c8cbd1]">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#593229] text-xs font-semibold text-white">{state.currentUser.name.slice(0, 1)}</div>
            {!collapsed && <span>{state.currentUser.name}</span>}
          </div>
        </div>
      </aside>

      <main className={`dashboard-main transition-all duration-200 ${collapsed ? "md:ml-[82px]" : "md:ml-[286px]"}`}>
        <header className="dashboard-topbar sticky top-0 z-30 flex h-20 items-center border-b border-[#eadbd2] bg-[#fffaf6]/88 px-4 backdrop-blur md:px-8">
          <button className="mr-3 md:hidden" onClick={() => setSidebarOpen(true)} aria-label="打开导航"><IconMenu2 /></button>
          <div><h1 className="text-lg font-semibold md:text-xl">{nav.find((n) => n.id === view)?.label}</h1><p className="hidden text-xs text-[#7b6258] sm:block">集中管理达人合作进度、费用与交付</p></div>
          <div className="ml-auto flex items-center gap-2">
            <select className="control max-w-32" value={month} onChange={(e) => setMonth(e.target.value)}>{monthOptions.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select>
            <button className="hidden h-10 w-10 place-items-center rounded-full bg-white sm:grid" onClick={() => setShowSettings(true)} aria-label="设置"><IconSettings size={19} /></button>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#593229] text-sm font-semibold text-white">{state.currentUser.name.slice(0, 1)}</div>
          </div>
        </header>
        <div className="dashboard-content p-4 md:p-8">{content}</div>
      </main>

      {sidebarOpen && <button aria-label="关闭导航" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-black/40 md:hidden" />}
      {showAdd && <AddInfluencer onClose={() => setShowAdd(false)} onSave={(influencer) => { setState((s) => ({ ...s, influencers: [influencer, ...s.influencers] })); setShowAdd(false); }} />}
      {showSettings && <SettingsModal state={state} month={month} months={monthOptions} onClose={() => setShowSettings(false)} onSave={({ budgetYuan, userName, defaultMonth, exportDirectory }) => { setState((s) => ({ ...s, monthlyFinance: { ...s.monthlyFinance, [defaultMonth]: { ...s.monthlyFinance?.[defaultMonth], budgetCents: Math.round(budgetYuan * 100) } }, settings: { ...s.settings, exportDirectory: exportDirectory.trim() || undefined }, currentUser: { ...s.currentUser, name: userName } })); setMonth(defaultMonth); setShowSettings(false); }} onReset={resetLocalData} />}
    </div>
  );
}

function SettingsModal({ state, month, months, onClose, onSave, onReset }: { state: AppState; month: string; months: string[]; onClose: () => void; onSave: (value: { budgetYuan: number; userName: string; defaultMonth: string; exportDirectory: string }) => void; onReset: () => void }) {
  const [budgetYuan, setBudgetYuan] = useState(String(getMonthBudgetCents(state, month) / 100));
  const [userName, setUserName] = useState(state.currentUser.name);
  const [defaultMonth, setDefaultMonth] = useState(month);
  const [exportDirectory, setExportDirectory] = useState(state.settings?.exportDirectory || "");
  const [confirmReset, setConfirmReset] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave({ budgetYuan: Number(budgetYuan || 0), userName: userName.trim() || state.currentUser.name, defaultMonth, exportDirectory });
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/45 p-3" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(e) => e.stopPropagation()} className="card flex h-full w-full max-w-xl flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-[#e5e7eb] p-5"><div><h2 className="text-xl font-semibold">系统设置</h2><p className="mt-1 text-sm text-[#687282]">本地演示配置，不保存任何密钥。</p></div><button type="button" onClick={onClose} aria-label="关闭"><IconX /></button></div>
        <div className="flex-1 space-y-5 overflow-auto p-5">
          <SettingsSection title="基础设置">
            <label className="text-sm">默认月份<select className="control mt-2 w-full" value={defaultMonth} onChange={(e) => { setDefaultMonth(e.target.value); setBudgetYuan(String(getMonthBudgetCents(state, e.target.value) / 100)); }}>{months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
            <label className="text-sm">月度预算目标（元）<input className="control mt-2 w-full" type="number" min={0} value={budgetYuan} onChange={(e) => setBudgetYuan(e.target.value)} /></label>
            <label className="text-sm">当前用户昵称<input className="control mt-2 w-full" value={userName} onChange={(e) => setUserName(e.target.value)} /></label>
          </SettingsSection>
          <SettingsSection title="本地存储与导出">
            <label className="text-sm">导出表格保存目录<input className="control mt-2 w-full" value={exportDirectory} onChange={(event) => setExportDirectory(event.target.value)} placeholder="例如 E:\imi-exports" /></label>
            <p className="text-xs leading-5 text-[#687282]">填写后，达人资源库和样品邮寄导出的 Excel 会保存到运行本应用的这台电脑目录。留空时仍使用浏览器下载。</p>
            <button type="button" className="btn text-xs" onClick={() => setConfirmReset(true)}><IconRefresh size={16} />清空本地演示数据并恢复默认</button>
            {confirmReset && <div className="rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-3 text-xs text-[#9f1239]"><p className="mb-3">确认后会删除浏览器本地演示数据，但不会影响当前页面访问。</p><div className="flex gap-2"><button type="button" className="btn" onClick={() => setConfirmReset(false)}>取消</button><button type="button" className="btn btn-primary" onClick={() => { onReset(); setConfirmReset(false); }}>确认重置</button></div></div>}
          </SettingsSection>
          <SettingsSection title="物流设置">
            <p className="text-sm leading-6 text-[#475569]">
              支持快递鸟或快递100真实查询：配置 <code>SHIPPING_PROVIDER=kdniao</code> 与 <code>KDNIAO_EBUSINESS_ID</code> / <code>KDNIAO_APP_KEY</code>，或配置快递100变量后，录入或刷新物流会调用对应服务；未配置时回退到手工物流台账。
            </p>
            <p className="mt-2 text-xs leading-5 text-[#687282]">顺丰、中通等快递可能需要手机号或后四位用于查询校验，密钥只放在 .env.local，不在页面保存；签收仍需人工确认后更新。</p>
          </SettingsSection>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#e5e7eb] p-5"><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn btn-primary" type="submit">保存设置</button></div>
      </form>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/80 bg-[#FAFAFC] p-4 shadow-[inset_2px_2px_5px_rgba(255,255,255,.88),inset_-3px_-3px_7px_rgba(206,211,220,.30)]"><h3 className="mb-3 flex items-center gap-2 font-semibold"><span className="h-2 w-2 rounded-full bg-[#7C6CEF] shadow-[0_0_0_6px_rgba(124,108,239,.08)]" />{title}</h3><div className="grid gap-4">{children}</div></section>;
}

function SectionTitle({ title, action }: { title: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-3 text-lg font-semibold tracking-[-0.015em] text-[#26272D]"><span className="h-2 w-2 rounded-full bg-[#7C6CEF] shadow-[0_0_0_6px_rgba(124,108,239,.08)]" />{title}</h2>{action}</div>;
}

function Metric({ label, value, note, tone = 0 }: { label: string; value: string; note?: string; tone?: number }) {
  const textTones = ["text-[#F29A57]", "text-[#7C6CEF]", "text-[#A38CF5]", "text-[#37D6A5]"];
  return <div className="card min-h-36 p-5"><span className={`mb-4 block h-1.5 w-8 rounded-full ${metricTone[tone % metricTone.length]} shadow-[0_6px_14px_rgba(124,108,239,.10)]`} /><p className="text-sm text-[#757A84]">{label}</p><strong className={`mt-4 block ${textTones[tone % textTones.length]} text-3xl tracking-[-0.045em] md:text-4xl`}>{value}</strong>{note && <p className="mt-3 text-xs text-[#A3A8B2]">{note}</p>}</div>;
}

function Progress({ value }: { value: number }) {
  return <div className="h-2 overflow-hidden rounded-full bg-[#E9ECF1] shadow-[inset_2px_2px_5px_rgba(255,255,255,.88),inset_-3px_-3px_7px_rgba(206,211,220,.30)]"><div className="h-full rounded-full bg-[#7C6CEF] transition-all" style={{ width: `${Math.min(100, value)}%` }} /></div>;
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-5"><div className="mb-3 flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#F29A57]" /><h3 className="text-sm font-medium text-[#26272D]">{title}</h3></div>{children}</div>;
}

function SortableTh({ label, sortKey, sort, onSort, initialDirection = "asc" }: { label: string; sortKey: CreatorDatabaseSortKey; sort: CreatorDatabaseSort | null; onSort: (key: CreatorDatabaseSortKey, initialDirection?: SortDirection) => void; initialDirection?: SortDirection }) {
  const active = sort?.key === sortKey;
  const directionLabel = active ? (sort.direction === "asc" ? "升序" : "降序") : "未排序";
  return (
    <th className="px-5 py-3" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(sortKey, initialDirection)}
        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-left font-medium transition hover:bg-white/80 hover:text-[#26272D] ${active ? "bg-white text-[#7C6CEF] shadow-[inset_2px_2px_5px_rgba(255,255,255,.88),inset_-3px_-3px_7px_rgba(206,211,220,.28)]" : "text-[#757A84]"}`}
        title={`点击按${label}排序，当前${directionLabel}`}
      >
        {label}
        <span className={`text-[10px] ${active ? "text-[#7C6CEF]" : "text-[#A3A8B2]"}`}>{active ? (sort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function ProjectRechargeProgress({ projects, executionPercent, progressed, target, onSave }: { projects: MonthlyProjectFinance[]; executionPercent: number; progressed: number; target: number; onSave?: (projects: MonthlyProjectFinance[]) => void }) {
  const [editing, setEditing] = useState(false);
  if (!projects.length) return null;
  const totals = projects.reduce((acc, project) => ({
    budgetCents: acc.budgetCents + project.budgetCents,
    rechargedCents: acc.rechargedCents + project.rechargedCents,
    consumedCents: acc.consumedCents + project.consumedCents,
    remainingRechargeCents: acc.remainingRechargeCents + project.remainingRechargeCents,
  }), { budgetCents: 0, rechargedCents: 0, consumedCents: 0, remainingRechargeCents: 0 });
  const progress = (project: MonthlyProjectFinance) => project.budgetCents ? Math.round(project.rechargedCents / project.budgetCents * 10000) / 100 : 0;
  const used = (project: MonthlyProjectFinance) => project.budgetCents ? Math.round(project.consumedCents / project.budgetCents * 10000) / 100 : 0;
  return (
    <section>
      <SectionTitle title="项目充值进度" action={<div className="flex items-center gap-2"><span className="hidden text-xs text-[#757A84] sm:inline">按项目预算、充值、消耗拆分</span>{onSave && <button type="button" className="btn btn-primary h-9 min-h-9 px-3 text-xs" onClick={() => setEditing(true)}><IconPencil size={15} />编辑充值</button>}</div>} />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="card overflow-hidden">
          <div className="grid grid-cols-5 border-b border-[#E3E6EC] bg-[#FAFAFC] px-5 py-3 text-xs text-[#757A84]">
            <span>项目</span><span>充值预算</span><span>已充值</span><span>已消耗</span><span>剩余额度</span>
          </div>
          <div className="divide-y divide-[#E3E6EC]">
            {projects.map((project) => (
              <div key={project.name} className="grid gap-2 px-5 py-4 text-sm md:grid-cols-5 md:items-center">
                <div className="font-semibold text-[#26272D]">{project.name}</div>
                <div>{money(project.budgetCents)}</div>
                <div>{money(project.rechargedCents)}</div>
                <div>{money(project.consumedCents)}</div>
                <div className="text-[#F29A57]">{money(project.remainingRechargeCents)}</div>
                <div className="md:col-span-5">
                  <div className="mb-1 flex justify-between text-xs text-[#757A84]"><span>充值进度 {progress(project)}%</span><span>消耗占预算 {used(project)}%</span></div>
                  <Progress value={progress(project)} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card flex min-h-full flex-col p-5">
          <p className="text-sm text-[#757A84]">本月项目合计</p>
          <strong className="mt-4 block text-4xl text-[#F29A57]">{totals.budgetCents ? Math.round(totals.rechargedCents / totals.budgetCents * 10000) / 100 : 0}%</strong>
          <div className="mt-4 space-y-3 text-sm text-[#26272D]">
            <div className="flex justify-between"><span>充值预算</span><span>{money(totals.budgetCents)}</span></div>
            <div className="flex justify-between"><span>已充值</span><span>{money(totals.rechargedCents)}</span></div>
            <div className="flex justify-between"><span>已消耗</span><span>{money(totals.consumedCents)}</span></div>
            <div className="flex justify-between text-[#F29A57]"><span>剩余可充值</span><span>{money(totals.remainingRechargeCents)}</span></div>
          </div>
          <div className="mt-auto border-t border-[#E3E6EC] pt-6">
            <p className="text-sm text-[#757A84]">达人执行进度</p>
            <strong className="mt-4 block text-4xl text-[#7C6CEF]">{executionPercent}%</strong>
            <div className="mt-4"><Progress value={executionPercent} /></div>
            <p className="mt-2 text-sm text-[#757A84]">当前 {progressed} / 目标 {target}</p>
          </div>
        </div>
      </div>
      {editing && onSave && <ProjectFinanceModal projects={projects} onClose={() => setEditing(false)} onSave={(next) => { onSave(next); setEditing(false); }} />}
    </section>
  );
}

function ProjectFinanceModal({ projects, onClose, onSave }: { projects: MonthlyProjectFinance[]; onClose: () => void; onSave: (projects: MonthlyProjectFinance[]) => void }) {
  const [rows, setRows] = useState(() => projects.map((project) => ({
    name: project.name,
    budgetYuan: String(project.budgetCents / 100),
    rechargedYuan: String(project.rechargedCents / 100),
    consumedYuan: String(project.consumedCents / 100),
  })));
  const update = (index: number, field: keyof (typeof rows)[number], value: string) => setRows((current) => current.map((row, i) => i === index ? { ...row, [field]: value } : row));
  const toCents = (value: string) => Math.max(0, Math.round(Number(value || 0) * 100));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = rows
      .map((row) => {
        const budgetCents = toCents(row.budgetYuan);
        const rechargedCents = toCents(row.rechargedYuan);
        const consumedCents = toCents(row.consumedYuan);
        return {
          name: row.name.trim(),
          budgetCents,
          rechargedCents,
          consumedCents,
          remainingRechargeCents: Math.max(0, budgetCents - rechargedCents),
        };
      })
      .filter((row) => row.name);
    onSave(next);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="card flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-[#E3E6EC] p-5">
          <div>
            <h2 className="text-xl font-semibold">编辑项目充值进度</h2>
            <p className="mt-1 text-sm text-[#757A84]">填写预算、已充值、已消耗；剩余可充值会自动按“预算 - 已充值”计算。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><IconX /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-auto p-5">
          <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_44px] gap-3 px-2 text-xs text-[#757A84] md:grid">
            <span>项目</span><span>充值预算（元）</span><span>已充值（元）</span><span>已消耗（元）</span><span />
          </div>
          {rows.map((row, index) => (
            <div key={`${row.name}-${index}`} className="grid gap-3 rounded-2xl border border-white/80 bg-[#FAFAFC] p-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_44px]">
              <input className="control w-full" value={row.name} onChange={(event) => update(index, "name", event.target.value)} placeholder="项目名称，如 小红书" required />
              <input className="control w-full" type="number" min={0} value={row.budgetYuan} onChange={(event) => update(index, "budgetYuan", event.target.value)} placeholder="预算" />
              <input className="control w-full" type="number" min={0} value={row.rechargedYuan} onChange={(event) => update(index, "rechargedYuan", event.target.value)} placeholder="已充值" />
              <input className="control w-full" type="number" min={0} value={row.consumedYuan} onChange={(event) => update(index, "consumedYuan", event.target.value)} placeholder="已消耗" />
              <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-[#fee2e2] text-[#d95d67] hover:bg-[#fff8f1]" onClick={() => setRows((current) => current.filter((_, i) => i !== index))} aria-label="删除项目"><IconTrash size={16} /></button>
            </div>
          ))}
          <button type="button" className="btn" onClick={() => setRows((current) => [...current, { name: "", budgetYuan: "0", rechargedYuan: "0", consumedYuan: "0" }])}><IconCirclePlus size={17} />添加项目</button>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E3E6EC] p-5">
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存项目数据</button>
        </div>
      </form>
    </div>
  );
}

function ProjectProgressSyncActions({ state, setState, month, projects, onMessage }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; month: string; projects: MonthlyProjectFinance[]; onMessage: (message: string, persistent?: boolean) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [externalChanged, setExternalChanged] = useState(false);
  const syncInfo = state.settings?.projectProgressSync?.[month];
  const signature = projectProgressSignature(month, projects);

  useEffect(() => {
    if (!syncInfo?.path) return;
    let cancelled = false;
    const checkExternalFile = async () => {
      try {
        const stat = await syncResourceLibraryFile("stat", syncInfo.path);
        if (!cancelled && stat.mtimeMs && syncInfo.mtimeMs && stat.mtimeMs > syncInfo.mtimeMs + 1000) {
          setExternalChanged(true);
          onMessage("检测到合作进度表已更新，点击「同步」可把表格中的项目充值数据读入系统。", true);
        }
      } catch {
        // 共享盘不可访问时不阻塞页面。
      }
    };
    void checkExternalFile();
    const timer = window.setInterval(checkExternalFile, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [month, onMessage, syncInfo?.mtimeMs, syncInfo?.path]);

  const saveMeta = (path: string, mtimeMs?: number, nextSignature = signature) => {
    setState((current) => ({
      ...current,
      settings: {
        ...current.settings,
        projectProgressSync: {
          ...current.settings?.projectProgressSync,
          [month]: { path, mtimeMs, signature: nextSignature },
        },
      },
    }));
  };

  const applyProjects = (nextProjects: MonthlyProjectFinance[], mtimeMs?: number, path?: string) => {
    const normalized = normalizeProjectRows(nextProjects);
    const nextSignature = projectProgressSignature(month, normalized);
    setState((current) => {
      const next = saveMonthProjectProgress(current, month, normalized);
      return path ? {
        ...next,
        settings: {
          ...next.settings,
          projectProgressSync: {
            ...next.settings?.projectProgressSync,
            [month]: { path, mtimeMs, signature: nextSignature },
          },
        },
      } : next;
    });
  };

  const exportProgress = async () => {
    const workbook = createProjectProgressWorkbook(month, projects);
    const buffer = await workbook.xlsx.writeBuffer();
    const result = await exportWorkbookBuffer(buffer, `合作进度表-${month}.xlsx`, state.settings?.exportDirectory);
    if (result.mode === "saved" && result.path) saveMeta(result.path, result.mtimeMs);
    onMessage(result.mode === "saved" ? `合作进度表已保存到：${result.path}` : "合作进度表已开始下载。");
  };

  const importProgressFromWorkbook = async (workbook: ExcelJS.Workbook, path?: string, mtimeMs?: number) => {
    const sheet = workbook.worksheets[0];
    if (!sheet) return;
    const rawRows: string[][] = [];
    sheet.eachRow((row) => {
      const values: string[] = [];
      const maxColumn = sheet.columnCount || row.cellCount;
      for (let index = 1; index <= maxColumn; index += 1) values.push(String(row.getCell(index).text || row.getCell(index).value || "").trim());
      rawRows.push(values);
    });
    const nextProjects = parseProjectProgressRawRows(rawRows, projects);
    if (!nextProjects.length) {
      onMessage("没有识别到可同步的项目充值行，请确认表格包含项目、充值预算、已充值、已消耗、剩余可充值。");
      return;
    }
    applyProjects(nextProjects, mtimeMs, path);
    setExternalChanged(false);
    onMessage(`已导入 ${nextProjects.length} 个项目的充值进度。`);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      await importProgressFromWorkbook(workbook);
    } catch (error) {
      onMessage(`导入失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const syncProgress = async () => {
    if (!syncInfo?.path) {
      await exportProgress();
      return;
    }
    setSyncing(true);
    try {
      const stat = await syncResourceLibraryFile("stat", syncInfo.path);
      const remoteNewer = Boolean(stat.mtimeMs && syncInfo.mtimeMs && stat.mtimeMs > syncInfo.mtimeMs + 1000);
      if (remoteNewer || externalChanged) {
        const payload = await syncResourceLibraryFile("readRows", syncInfo.path);
        const nextProjects = parseProjectProgressRawRows(payload.rawRows || [], projects);
        if (!nextProjects.length) {
          onMessage("同步失败：没有在合作进度表中识别到项目充值数据。");
          return;
        }
        applyProjects(nextProjects, payload.mtimeMs, syncInfo.path);
        setExternalChanged(false);
        onMessage(`已从合作进度表同步 ${nextProjects.length} 个项目。`);
        return;
      }

      const workbook = createProjectProgressWorkbook(month, projects);
      const buffer = await workbook.xlsx.writeBuffer();
      const payload = await syncResourceLibraryFile("write", syncInfo.path, bufferToBase64(buffer));
      saveMeta(syncInfo.path, payload.mtimeMs, signature);
      onMessage(syncInfo.signature !== signature ? "已把系统当前项目充值数据同步到合作进度表。" : "合作进度表已是最新。");
    } catch (error) {
      onMessage(`同步失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={(event) => importFile(event.target.files?.[0])} />
      <button type="button" className="btn h-9 min-h-9 px-3 text-xs" onClick={() => fileRef.current?.click()}><IconUpload size={15} />导入</button>
      <button type="button" className="btn h-9 min-h-9 px-3 text-xs" onClick={exportProgress}><IconDownload size={15} />导出</button>
      <button type="button" className="btn h-9 min-h-9 px-3 text-xs" onClick={syncProgress} disabled={syncing}><IconRefresh size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "同步中" : "同步"}{externalChanged && <span className="ml-1 h-2 w-2 rounded-full bg-[#f97316]" />}</button>
    </div>
  );
}

function Overview({ state, setState, month, onDrilldown }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; month: string; onDrilldown: (filter: DrilldownFilter) => void }) {
  const [message, setMessage] = useState("");
  const [persistentMessage, setPersistentMessage] = useState(false);
  const items = state.collaborations.filter((c) => c.month === month);
  const a = getAnalytics(items, getMonthBudgetCents(state, month), { averageCents: getMonthAverageCents(state, month) });
  const projectProgress = getMonthProjectProgress(state, month);
  const published = items.filter((i) => i.status === "笔记已发布" || i.status === "合作已完成").length;
  const pending = items.filter((i) => !["合作已完成", "笔记已发布"].includes(i.status)).length;
  useEffect(() => {
    if (!message || persistentMessage) return;
    const timer = window.setTimeout(() => setMessage(""), 5200);
    return () => window.clearTimeout(timer);
  }, [message, persistentMessage]);
  const showMessage = (nextMessage: string, persistent = false) => {
    setMessage(nextMessage);
    setPersistentMessage(persistent);
  };
  return (
    <div className="space-y-7">
      <AnnualRechargeBudget state={state} month={month} />
      <SectionTitle title="本月合作数据" action={<ProjectProgressSyncActions state={state} setState={setState} month={month} projects={projectProgress} onMessage={showMessage} />} />
      {message && <p className="flex items-center justify-between gap-3 rounded-xl border border-[#bfdbfe] bg-[#dbeafe] p-3 text-xs text-[#1d4ed8]"><span>{message}</span><button type="button" className="shrink-0 rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => { setMessage(""); setPersistentMessage(false); }}>关闭</button></p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Metric label="合作达人" value={`${items.length}`} note="本月全部合作记录" tone={0} /><Metric label="达人花费" value={money(a.spendCents)} note={`预算使用 ${a.budgetPercent}%`} tone={1} /><Metric label="已发布内容" value={`${published}`} note="包含已完成合作" tone={2} /><Metric label="待处理任务" value={`${pending}`} note="需要跟进的合作节点" tone={3} /></div>
      <div className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]"><ChartCard title="本月合作进度"><BarChart data={groupCount(items, "status")} height={380} /></ChartCard><ChartCard title="费用状态"><PieChart data={groupCount(items, "paymentStatus")} height={380} onItemClick={(value) => onDrilldown({ field: "paymentStatus", value, title: "费用状态" })} /></ChartCard></div>
      <ProjectRechargeProgress projects={projectProgress} executionPercent={a.executionPercent} progressed={a.progressed} target={a.executionTarget} onSave={(projects) => setState((current) => saveMonthProjectProgress(current, month, projects))} />
    </div>
  );
}

function accountList(influencer: Influencer) {
  return influencer.platformAccounts?.length
    ? influencer.platformAccounts
    : [{ id: `${influencer.id}-legacy`, platform: influencer.platform, handle: influencer.handle, url: profileSearchUrl(influencer.platform, influencer.handle), followers: influencer.followers }];
}

function profileSearchUrl(platform: Influencer["platform"], handle: string) {
  return `https://www.baidu.com/s?wd=${encodeURIComponent(`${platform} ${handle.replace(/^@/, "")}`)}`;
}

function formatFollowers(value: number) {
  return value >= 10000 ? `${(value / 10000).toFixed(1)}万` : String(value);
}

function yuanNumber(value: string | number | undefined) {
  if (value === undefined || value === null) return 0;
  const normalized = String(value).replace(/[¥￥,\s]/g, "").replace(/-/g, "0");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function projectProgressSignature(month: string, projects: MonthlyProjectFinance[]) {
  return JSON.stringify({ month, projects: projects.map((project) => ({ ...project })) });
}

function normalizeProjectRows(projects: MonthlyProjectFinance[]) {
  return projects.map((project) => ({
    ...project,
    remainingRechargeCents: Math.max(0, project.budgetCents - project.rechargedCents),
  }));
}

function projectProgressTotals(projects: MonthlyProjectFinance[]) {
  return projects.reduce((acc, project) => ({
    budgetCents: acc.budgetCents + project.budgetCents,
    rechargedCents: acc.rechargedCents + project.rechargedCents,
    consumedCents: acc.consumedCents + project.consumedCents,
    remainingRechargeCents: acc.remainingRechargeCents + project.remainingRechargeCents,
  }), { budgetCents: 0, rechargedCents: 0, consumedCents: 0, remainingRechargeCents: 0 });
}

function createProjectProgressWorkbook(month: string, projects: MonthlyProjectFinance[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("合作进度表");
  const monthNumber = Number(month.split("-")[1]);
  const rows = normalizeProjectRows(projects);
  const totals = projectProgressTotals(rows);
  sheet.columns = [
    { key: "group", width: 20 },
    { key: "project", width: 16 },
    { key: "budget", width: 16 },
    { key: "recharged", width: 14 },
    { key: "consumed", width: 14 },
    { key: "remaining", width: 18 },
    { key: "progress", width: 18 },
  ];
  sheet.mergeCells("A1:G1");
  sheet.getCell("A1").value = `${month.replace("-", "年")}月品牌部站外推广进度表`;
  sheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3A3A3A" } };
  sheet.mergeCells("A2:B3");
  sheet.getCell("A2").value = "小组";
  sheet.getCell("A2").font = { bold: true, size: 16 };
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCDE3B8" } };
  sheet.mergeCells("C2:G2");
  sheet.getCell("C2").value = "充值进度";
  sheet.getCell("C2").font = { bold: true, size: 16 };
  sheet.getCell("C2").alignment = { horizontal: "center" };
  sheet.getCell("C2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
  sheet.getRow(3).values = ["", "", `${monthNumber}月充值\n总预算`, "已充值", "已消耗", `${monthNumber}月计划剩余\n可充值金额`, "本月充值进度\n(充值金额/预算)"];
  sheet.getRow(3).font = { bold: true };
  rows.forEach((project) => {
    const row = sheet.addRow(["【媒介组】", project.name, project.budgetCents / 100, project.rechargedCents / 100, project.consumedCents / 100, project.remainingRechargeCents / 100, project.budgetCents ? project.rechargedCents / project.budgetCents : 0]);
    row.getCell(7).numFmt = "0.00%";
  });
  const totalRow = sheet.addRow(["", "合计", totals.budgetCents / 100, totals.rechargedCents / 100, totals.consumedCents / 100, totals.remainingRechargeCents / 100, totals.budgetCents ? totals.rechargedCents / totals.budgetCents : 0]);
  totalRow.font = { bold: true };
  totalRow.getCell(7).numFmt = "0.00%";
  sheet.addRow(["月度更新消耗情况，不会超过充值金额"]);
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const columnNumber = Number(cell.col);
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
      cell.alignment = { vertical: "middle", horizontal: columnNumber === 1 || columnNumber === 2 ? "left" : "center", wrapText: true };
      if ([3, 4, 5, 6].includes(columnNumber) && typeof cell.value === "number") cell.numFmt = "#,##0";
    });
  });
  sheet.getColumn(6).eachCell((cell, rowNumber) => {
    if (rowNumber >= 3) {
      cell.font = { ...(cell.font || {}), color: { argb: "FFFF0000" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };
    }
  });
  return workbook;
}

function parseProjectProgressRawRows(rawRows: string[][], fallbackProjects: MonthlyProjectFinance[]) {
  const knownNames = new Set(["小红书", "抖音", "B站", "舆情处理", "供应商", ...fallbackProjects.map((project) => project.name)]);
  const ignored = /合计|线下|渠道|策划|销售|设计|责任人|充值进度|小组|品牌部|推广进度|月度更新|项目|预算|已充值|已消耗/;
  const projects: MonthlyProjectFinance[] = [];
  rawRows.forEach((row) => {
    const cells = row.map((cell) => String(cell || "").trim());
    const projectIndex = cells.findIndex((cell, index) => knownNames.has(cell) || (cell && !ignored.test(cell) && yuanNumber(cells[index + 1]) > 0));
    if (projectIndex < 0) return;
    const name = cells[projectIndex];
    if (!name || ignored.test(name)) return;
    const numericValues = cells.slice(projectIndex + 1).map(yuanNumber).filter((value) => value > 0);
    if (!numericValues.length) return;
    const budgetCents = Math.round((numericValues[0] || 0) * 100);
    const rechargedCents = Math.round((numericValues[1] || 0) * 100);
    const consumedCents = Math.round((numericValues[2] || 0) * 100);
    const remainingRechargeCents = Math.max(0, Math.round((numericValues[3] || Math.max(0, numericValues[0] - numericValues[1])) * 100));
    if (budgetCents > 0) projects.push({ name, budgetCents, rechargedCents, consumedCents, remainingRechargeCents });
  });
  return normalizeProjectRows(projects);
}

function AnnualRechargeBudget({ state, month }: { state: AppState; month: string }) {
  const year = month.slice(0, 4);
  const yearly = getYearProjectProgress(state, year);
  const totals = projectProgressTotals(yearly.projects);
  const rechargePercent = totals.budgetCents ? Math.round(totals.rechargedCents / totals.budgetCents * 10000) / 100 : 0;
  const consumePercent = totals.budgetCents ? Math.round(totals.consumedCents / totals.budgetCents * 10000) / 100 : 0;
  const topProjects = [...yearly.projects].sort((a, b) => b.budgetCents - a.budgetCents).slice(0, 5);
  return (
    <section className="card overflow-hidden p-5">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-medium text-[#20C5E8]">{year} 年度</p>
          <h2 className="mt-1 text-xl font-semibold text-[#1d2638]">年度充值预算</h2>
          <p className="mt-1 text-sm text-[#667085]">汇总全年各月项目充值预算、已充值、已消耗与剩余额度。</p>
        </div>
        <div className="rounded-xl bg-[#f8fafc] px-4 py-3 text-right">
          <p className="text-xs text-[#667085]">覆盖月份</p>
          <strong className="mt-1 block text-lg text-[#6F4EF6]">{yearly.months.length} 个月</strong>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl bg-[#f8fafc] p-4"><p className="text-xs text-[#667085]">年度充值预算</p><strong className="mt-2 block text-2xl text-[#6F4EF6]">{money(totals.budgetCents)}</strong></div>
        <div className="rounded-xl bg-[#f8fafc] p-4"><p className="text-xs text-[#667085]">年度已充值</p><strong className="mt-2 block text-2xl text-[#20C5E8]">{money(totals.rechargedCents)}</strong><span className="mt-1 block text-xs text-[#98a2b3]">充值进度 {rechargePercent}%</span></div>
        <div className="rounded-xl bg-[#f8fafc] p-4"><p className="text-xs text-[#667085]">年度已消耗</p><strong className="mt-2 block text-2xl text-[#F29A57]">{money(totals.consumedCents)}</strong><span className="mt-1 block text-xs text-[#98a2b3]">消耗占比 {consumePercent}%</span></div>
        <div className="rounded-xl bg-[#f8fafc] p-4"><p className="text-xs text-[#667085]">剩余可充值</p><strong className="mt-2 block text-2xl text-[#32C59D]">{money(totals.remainingRechargeCents)}</strong></div>
      </div>
      {topProjects.length ? (
        <div className="mt-5 grid gap-3 lg:grid-cols-5">
          {topProjects.map((project) => {
            const percent = project.budgetCents ? Math.min(100, Math.round(project.rechargedCents / project.budgetCents * 100)) : 0;
            return (
              <div key={project.name} className="rounded-xl border border-[#e7ecf1] bg-white p-3">
                <div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">{project.name}</span><span className="text-xs text-[#667085]">{percent}%</span></div>
                <Progress value={percent} />
                <p className="mt-2 text-xs text-[#667085]">{money(project.rechargedCents)} / {money(project.budgetCents)}</p>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function createInfluencerWorkbook(influencers: Influencer[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("达人资源库");
  sheet.columns = ["名称", "账号明细", "类型", "城市", "总粉丝数", "报价元", "电话", "标签"].map((header) => ({ header, key: header, width: 22 }));
  sheet.addRows(influencers.map((i) => ({
    名称: i.name,
    账号明细: accountList(i).map((a) => `${a.platform}:${a.handle}:${a.url}:${a.followers}`).join(" | "),
    类型: i.type,
    城市: i.city,
    总粉丝数: accountList(i).reduce((sum, a) => sum + a.followers, 0),
    报价元: i.quoteCents / 100,
    电话: i.phone,
    标签: i.tags.join("、"),
  })));
  return workbook;
}

function influencerSyncSignature(influencers: Influencer[]) {
  return JSON.stringify(influencers.map((i) => ({
    id: i.id,
    name: i.name,
    accounts: accountList(i).map((a) => ({ platform: a.platform, handle: a.handle, url: a.url, followers: a.followers })),
    type: i.type,
    city: i.city,
    quoteCents: i.quoteCents,
    phone: i.phone,
    tags: i.tags,
  })));
}

function parseInfluencerRows(rows: Record<string, string | number>[]) {
  return rows.map((r, index) => {
    const accountText = String(r["账号明细"] || "");
    const rowFollowers = Math.round(Number(r["粉丝数"] || r["总粉丝数"] || 0));
    const fallbackPlatform = (["小红书", "抖音", "微博", "B站"].includes(String(r["平台"])) ? String(r["平台"]) : "小红书") as Influencer["platform"];
    const rawAccounts = accountText ? accountText.split(/\s+\|\s+/).filter(Boolean) : [];
    const accounts = rawAccounts.map((entry) => {
      const platformMatch = entry.match(/^(小红书|抖音|微博|B站):/);
      const platform = (platformMatch?.[1] || fallbackPlatform) as Influencer["platform"];
      const rest = platformMatch ? entry.slice(platformMatch[0].length) : entry;
      const followerMatch = rest.match(/:(\d+(?:\.\d+)?)$/);
      const followers = rawAccounts.length === 1 && rowFollowers > 0 ? rowFollowers : Math.round(Number(followerMatch?.[1] || rowFollowers || 0));
      const withoutFollowers = followerMatch ? rest.slice(0, -followerMatch[0].length) : rest;
      const urlMatch = withoutFollowers.match(/https?:\/\/.+/);
      const url = urlMatch?.[0] || String(r["链接"] || "");
      const handle = (urlMatch ? withoutFollowers.slice(0, urlMatch.index).replace(/:$/, "") : withoutFollowers).trim() || String(r["账号"] || "");
      return { id: crypto.randomUUID(), platform, handle, url: url || profileSearchUrl(platform, handle), followers, lastSyncedAt: new Date().toISOString() };
    });
    const primary = accounts[0] || { id: crypto.randomUUID(), platform: fallbackPlatform, handle: String(r["账号"] || ""), url: String(r["链接"] || ""), followers: rowFollowers };
    return {
      id: `sync-${Date.now()}-${index}`,
      name: String(r["名称"] || r["达人名称"] || "未命名达人"),
      handle: primary.handle,
      platform: primary.platform,
      platformAccounts: accounts.length ? accounts : [{ ...primary, url: primary.url || profileSearchUrl(primary.platform, primary.handle) }],
      type: String(r["类型"] || "待分类"),
      city: String(r["城市"] || "未填写"),
      followers: primary.followers,
      quoteCents: Math.round(Number(r["报价元"] || 0) * 100),
      phone: String(r["电话"] || ""),
      tags: String(r["标签"] || "").split(/[、,，]/).filter(Boolean),
    } satisfies Influencer;
  });
}

function Influencers({ state, setState, onAdd }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; onAdd: () => void }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Influencer | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [externalChanged, setExternalChanged] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const filtered = state.influencers.filter((i) => `${i.name}${i.handle}${i.type}${i.city}${accountList(i).map((a) => `${a.platform}${a.handle}`).join("")}`.toLowerCase().includes(query.toLowerCase()));
  const syncInfo = state.settings?.resourceLibrarySync;
  const currentSignature = influencerSyncSignature(state.influencers);
  const syncButtonLabel = syncInfo?.path ? "同步" : "导出";

  useEffect(() => {
    if (!message || message.startsWith("检测到表格文件")) return;
    const timer = window.setTimeout(() => setMessage(""), 5200);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!syncInfo?.path) return;
    let cancelled = false;
    const checkExternalFile = async () => {
      try {
        const stat = await syncResourceLibraryFile("stat", syncInfo.path);
        if (!cancelled && stat.mtimeMs && syncInfo.mtimeMs && stat.mtimeMs > syncInfo.mtimeMs + 1000) {
          setExternalChanged(true);
          setMessage("检测到表格文件已更新，点击「同步」可把表格修改读入系统；如果系统内也改过，则点击「同步」会以系统当前数据写回表格。");
        }
      } catch {
        // 共享盘暂时不可访问时不打断页面使用。
      }
    };
    void checkExternalFile();
    const timer = window.setInterval(checkExternalFile, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [syncInfo?.path, syncInfo?.mtimeMs]);

  const saveSyncMeta = (path: string, mtimeMs?: number, signature = currentSignature) => {
    setState((s) => ({ ...s, settings: { ...s.settings, resourceLibrarySync: { path, mtimeMs, signature } } }));
  };
  const updateInfluencer = (next: Influencer) => {
    setState((s) => ({
      ...s,
      influencers: s.influencers.map((i) => i.id === next.id ? next : i),
      collaborations: s.collaborations.map((c) => c.influencerId === next.id ? { ...c, influencerName: next.name } : c),
    }));
    setEditing(null);
  };
  const deleteInfluencer = (id: string) => {
    const target = state.influencers.find((i) => i.id === id);
    if (!target || !confirm(`确认删除「${target.name}」吗？相关合作记录会保留，但达人档案将移除。`)) return;
    setState((s) => ({ ...s, influencers: s.influencers.filter((i) => i.id !== id) }));
  };
  const fetchFollowerAccount = async (account: PlatformAccount) => {
    const response = await fetch("/api/influencers/followers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...account, currentFollowers: account.followers }) });
    if (!response.ok) throw new Error("refresh failed");
    const result = await response.json() as { followers: number; lastSyncedAt?: string; note?: string; provider?: string };
    return { ...account, followers: account.followers, lastSyncedAt: result.lastSyncedAt, provider: result.provider };
  };
  const applyRefreshedAccounts = (influencerId: string, accounts: PlatformAccount[]) => {
    setState((s) => ({ ...s, influencers: s.influencers.map((i) => {
      if (i.id !== influencerId) return i;
      const primary = accounts[0] || accountList(i)[0];
      return { ...i, platformAccounts: accounts, platform: primary.platform, handle: primary.handle, followers: primary.followers };
    }) }));
  };
  const refreshInfluencerFollowers = async (influencer: Influencer) => {
    setRefreshing(influencer.id);
    setMessage("");
    try {
      const refreshed = await Promise.all(accountList(influencer).map((account) => fetchFollowerAccount(account)));
      applyRefreshedAccounts(influencer.id, refreshed);
      setMessage(refreshed.some((account) => account.provider === "mock") ? "已更新时间；本地模式不自动抓取真实粉丝，接入平台授权或第三方数据服务后可替换为实时数据。" : "粉丝数据已同步。");
    } catch {
      setMessage("粉丝刷新失败，已保留当前数据。");
    } finally {
      setRefreshing(null);
    }
  };
  const refreshVisibleFollowers = async () => {
    setRefreshing("all");
    setMessage("");
    try {
      const results = await Promise.all(filtered.map(async (influencer) => ({
        influencer,
        accounts: await Promise.all(accountList(influencer).map((account) => fetchFollowerAccount(account))),
      })));
      setState((s) => ({ ...s, influencers: s.influencers.map((i) => {
        const found = results.find((result) => result.influencer.id === i.id);
        if (!found) return i;
        const primary = found.accounts[0] || accountList(i)[0];
        return { ...i, platformAccounts: found.accounts, platform: primary.platform, handle: primary.handle, followers: primary.followers };
      }) }));
      setMessage("当前筛选结果已更新时间；本地模式不自动抓取真实粉丝。");
    } catch {
      setMessage("批量刷新失败，已保留当前数据。");
    } finally {
      setRefreshing(null);
    }
  };
  const exportData = async () => {
    const workbook = createInfluencerWorkbook(state.influencers);
    const buffer = await workbook.xlsx.writeBuffer();
    try {
      const result = await exportWorkbookBuffer(buffer, "达人资源库.xlsx", state.settings?.exportDirectory);
      if (result.mode === "saved" && result.path) saveSyncMeta(result.path, result.mtimeMs, currentSignature);
      setMessage(result.mode === "saved" ? `达人资源库已保存到：${result.path}` : "达人资源库已开始下载。");
    } catch (error) {
      setMessage(`导出失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };
  const syncData = async () => {
    if (!syncInfo?.path) {
      await exportData();
      return;
    }
    setSyncing(true);
    setMessage("");
    try {
      const stat = await syncResourceLibraryFile("stat", syncInfo.path);
      const remoteNewer = Boolean(stat.mtimeMs && syncInfo.mtimeMs && stat.mtimeMs > syncInfo.mtimeMs + 1000);
      const localDirty = Boolean(syncInfo.signature && syncInfo.signature !== currentSignature);

      if (remoteNewer || externalChanged) {
        const payload = await syncResourceLibraryFile("read", syncInfo.path);
        const nextInfluencers = parseInfluencerRows(payload.rows || []);
        const nextSignature = influencerSyncSignature(nextInfluencers);
        setState((s) => ({ ...s, influencers: nextInfluencers, settings: { ...s.settings, resourceLibrarySync: { path: syncInfo.path, mtimeMs: payload.mtimeMs, signature: nextSignature } } }));
        setExternalChanged(false);
        setMessage(`已从表格同步 ${nextInfluencers.length} 位达人。`);
        return;
      }

      const workbook = createInfluencerWorkbook(state.influencers);
      const buffer = await workbook.xlsx.writeBuffer();
      const payload = await syncResourceLibraryFile("write", syncInfo.path, bufferToBase64(buffer));
      saveSyncMeta(syncInfo.path, payload.mtimeMs, currentSignature);
      setExternalChanged(false);
      setMessage(localDirty ? "已把系统当前修改同步到表格。" : "表格已是最新。");
    } catch (error) {
      setMessage(`同步失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setSyncing(false);
    }
  };
  const importData = async (file?: File) => {
    if (!file) return;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet = workbook.worksheets[0];
    if (!sheet) return;
    const headers = (sheet.getRow(1).values as ExcelJS.CellValue[]).slice(1).map(String);
    const rows: Record<string, string | number>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const r: Record<string, string | number> = {};
      headers.forEach((header, index) => {
        const value = row.getCell(index + 1).value;
        r[header] = typeof value === "number" ? value : String(value ?? "");
      });
      rows.push(r);
    });
    const added = parseInfluencerRows(rows);
    setState((s) => ({ ...s, influencers: [...added, ...s.influencers] }));
  };
  return (
    <div>
      <SectionTitle title={`达人资源库 · ${filtered.length}`} action={<div className="flex gap-2"><input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => importData(e.target.files?.[0])} /><button className="btn hidden sm:flex" onClick={() => fileRef.current?.click()}><IconUpload size={17} />导入</button><button className="btn hidden sm:flex" onClick={syncData} disabled={syncing}><IconDownload size={17} />{syncing ? "同步中" : syncButtonLabel}{externalChanged && <span className="ml-1 h-2 w-2 rounded-full bg-[#f97316]" />}</button><button className="btn border-[#f8c8ab] bg-[#fee8d9] text-[#a23c0f] hover:bg-[#fff4ed]" onClick={onAdd}><IconCirclePlus size={18} />新增达人</button></div>} />
      {message && <p className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-[#bfdbfe] bg-[#dbeafe] p-3 text-xs text-[#1d4ed8]"><span>{message}</span><button type="button" className="shrink-0 rounded-lg px-2 py-1 hover:bg-white/70" onClick={() => setMessage("")}>关闭</button></p>}
      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-[#e5e7eb] p-4"><IconSearch size={19} className="text-[#64748b]" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent outline-none" placeholder="搜索达人、账号、平台、类型或城市" /></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left text-sm"><thead className="bg-[#f8fafc] text-xs text-[#687282]"><tr><th className="px-5 py-3 font-medium">达人</th><th className="px-5 py-3 font-medium">多平台账号</th><th className="px-5 py-3 font-medium">类型/城市</th><th className="px-5 py-3 font-medium"><button type="button" onClick={refreshVisibleFollowers} disabled={refreshing === "all"} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white hover:text-[#111827]" title="点击刷新当前筛选结果的粉丝数"><IconRefresh size={13} />{refreshing === "all" ? "刷新中" : "总粉丝"}</button></th><th className="px-5 py-3 font-medium">参考报价</th><th className="px-5 py-3 font-medium">标签</th><th className="px-5 py-3 font-medium">联系方式</th><th className="px-3 py-3 text-center font-medium">操作</th></tr></thead><tbody>{filtered.map((i) => {
          const accounts = accountList(i);
          const totalFollowers = accounts.reduce((sum, a) => sum + a.followers, 0);
          return <tr key={i.id} className="border-t border-[#e5e7eb] align-top hover:bg-white"><td className="px-5 py-4"><div className="font-medium">{i.name}</div><div className="text-xs text-[#7b8492]">{accounts.length} 个平台账号</div></td><td className="px-5 py-4"><div className="space-y-2">{accounts.map((a) => <div key={a.id} className="rounded-xl border border-[#e5e7eb] bg-[#f8fafc] px-3 py-2"><div className="flex flex-wrap items-center gap-2"><span className={`tag ${platformTagClass(a.platform)}`}>{a.platform}</span><a href={a.url || profileSearchUrl(a.platform, a.handle)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-[#1d4ed8] hover:underline">{a.handle || "未填写账号"}<IconExternalLink size={13} /></a></div><p className="mt-1 text-xs text-[#687282]">粉丝 {formatFollowers(a.followers)}{a.lastSyncedAt ? ` · ${new Date(a.lastSyncedAt).toLocaleString("zh-CN", { hour12: false })}` : ""}</p></div>)}</div></td><td className="px-5 py-4"><div>{i.type}</div><div className="mt-1 text-xs text-[#687282]">{i.city}</div></td><td className="px-5 py-4"><button type="button" onClick={() => refreshInfluencerFollowers(i)} disabled={refreshing === i.id || refreshing === "all"} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium hover:bg-[#f1f5f9] disabled:opacity-60" title="点击刷新该达人所有平台粉丝数"><IconRefresh size={13} className={refreshing === i.id ? "animate-spin" : ""} />{refreshing === i.id ? "刷新中" : formatFollowers(totalFollowers)}</button></td><td className="px-5 py-4 font-medium">{money(i.quoteCents)}</td><td className="px-5 py-4"><div className="flex flex-wrap gap-1">{i.tags.slice(0, 3).map((t) => <span className={`tag ${toneFor(t)}`} key={t}>{t}</span>)}</div></td><td className="px-5 py-4">{i.phone}</td><td className="px-3 py-4"><div className="flex justify-center gap-1"><button className="grid h-8 w-8 place-items-center rounded-lg border border-[#e5e7eb] text-[#475569] hover:bg-[#f8fafc] hover:text-[#111827]" onClick={() => setEditing(i)} title="编辑" aria-label={`编辑 ${i.name}`}><IconPencil size={15} /></button><button className="grid h-8 w-8 place-items-center rounded-lg border border-[#fee2e2] text-[#be123c] hover:bg-[#fff1f2]" onClick={() => deleteInfluencer(i.id)} title="删除" aria-label={`删除 ${i.name}`}><IconTrash size={15} /></button></div></td></tr>;
        })}</tbody></table></div>
      </div>
      {editing && <InfluencerForm title="编辑达人" initial={editing} onClose={() => setEditing(null)} onSave={updateInfluencer} />}
    </div>
  );
}

function CreatorDatabase({ state, month, filter, onClearFilter }: { state: AppState; month: string; filter: DrilldownFilter | null; onClearFilter: () => void }) {
  const [sort, setSort] = useState<CreatorDatabaseSort | null>(null);
  const influencerMap = new Map(state.influencers.map((influencer) => [influencer.id, influencer]));
  const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });
  const items = state.collaborations.filter((item) => item.month === month).filter((item) => !filter || String(item[filter.field] || "") === filter.value);
  const compareText = (a?: string, b?: string) => collator.compare(a || "", b || "");
  const compareBlankLast = (a?: string, b?: string) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return compareText(a, b);
  };
  const primaryPlatform = (item: Collaboration) => {
    const influencer = influencerMap.get(item.influencerId);
    return influencer ? accountList(influencer)[0]?.platform || "" : "";
  };
  const compareBase = (a: Collaboration, b: Collaboration) => compareText(a.plannedPublishDate, b.plannedPublishDate) || compareText(a.influencerName, b.influencerName);
  const compareItems = (a: Collaboration, b: Collaboration) => {
    if (!sort) return 0;
    const influencerA = influencerMap.get(a.influencerId);
    const influencerB = influencerMap.get(b.influencerId);
    let result = 0;
    if (sort.key === "name") result = compareText(a.influencerName, b.influencerName) || compareBase(a, b);
    if (sort.key === "platform") result = compareText(primaryPlatform(a), primaryPlatform(b)) || compareText(a.plannedPublishDate, b.plannedPublishDate) || compareText(a.influencerName, b.influencerName);
    if (sort.key === "city") result = compareText(influencerA?.city, influencerB?.city) || compareText(influencerA?.type, influencerB?.type) || compareBase(a, b);
    if (sort.key === "status") result = (statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status)) || compareBase(a, b);
    if (sort.key === "paymentStatus") result = compareText(a.paymentStatus, b.paymentStatus) || compareBase(a, b);
    if (sort.key === "intent") result = compareText(a.cooperationIntent, b.cooperationIntent) || compareBase(a, b);
    if (sort.key === "brandResult") result = compareText(a.brandResult, b.brandResult) || compareBase(a, b);
    if (sort.key === "rejectReason") result = compareBlankLast(a.influencerRejectReason || a.brandRejectReason, b.influencerRejectReason || b.brandRejectReason) || compareBase(a, b);
    if (sort.key === "owner") result = compareText(a.owner, b.owner) || compareBase(a, b);
    if (sort.key === "fee") result = (a.feeCents - b.feeCents) || compareBase(a, b);
    return sort.direction === "asc" ? result : -result;
  };
  const sortedItems = sort ? [...items].sort(compareItems) : items;
  const requestSort = (key: CreatorDatabaseSortKey, initialDirection: SortDirection = "asc") => {
    setSort((current) => current?.key === key ? { key, direction: current.direction === "asc" ? "desc" : "asc" } : { key, direction: initialDirection });
  };
  return (
    <div>
      <SectionTitle title={`达人数据库 · ${items.length}`} action={filter ? <button className="btn px-3 py-2 text-xs" onClick={onClearFilter}>清除筛选</button> : <span className="text-sm text-[#6f5d55]">按当前月份汇总合作达人</span>} />
      {filter && <p className="mb-4 rounded-xl border border-[#f8c8ab] bg-[#fee8d9] p-3 text-xs text-[#9a3c0f]">当前筛选：{filter.title} = {filter.value}</p>}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1240px] text-left text-sm">
            <thead className="bg-[#FAFAFC] text-xs text-[#757A84]"><tr><SortableTh label="达人" sortKey="name" sort={sort} onSort={requestSort} /><SortableTh label="平台账号" sortKey="platform" sort={sort} onSort={requestSort} /><SortableTh label="达人类型/城市" sortKey="city" sort={sort} onSort={requestSort} /><SortableTh label="合作节点" sortKey="status" sort={sort} onSort={requestSort} /><SortableTh label="付款状态" sortKey="paymentStatus" sort={sort} onSort={requestSort} /><SortableTh label="合作意向" sortKey="intent" sort={sort} onSort={requestSort} /><SortableTh label="提报结果" sortKey="brandResult" sort={sort} onSort={requestSort} /><SortableTh label="拒绝原因" sortKey="rejectReason" sort={sort} onSort={requestSort} /><SortableTh label="负责人" sortKey="owner" sort={sort} onSort={requestSort} /><SortableTh label="费用" sortKey="fee" sort={sort} onSort={requestSort} initialDirection="desc" /></tr></thead>
            <tbody>{sortedItems.map((item) => {
              const influencer = influencerMap.get(item.influencerId);
              const accounts = influencer ? accountList(influencer) : [];
              return <tr key={item.id} className="border-t border-[#ead8cd] align-top hover:bg-[#fffaf6]"><td className="px-5 py-4"><div className="font-medium">{item.influencerName}</div><div className="mt-1 text-xs text-[#7b6258]">{item.plannedPublishDate}</div></td><td className="px-5 py-4"><div className="space-y-1">{accounts.length ? accounts.map((account) => <a key={account.id} href={account.url || profileSearchUrl(account.platform, account.handle)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs font-medium text-[#1d4ed8] hover:underline"><span className={`tag ${platformTagClass(account.platform)}`}>{account.platform}</span>{account.handle || "未填写账号"}<IconExternalLink size={12} /></a>) : <span className="text-xs text-[#7b6258]">暂无账号</span>}</div></td><td className="px-5 py-4"><div>{influencer?.type || "未建档"}</div><div className="mt-1 text-xs text-[#7b6258]">{influencer?.city || "未填写"}</div></td><td className="px-5 py-4"><span className={`tag ${toneFor(item.status)}`}>{item.status}</span></td><td className="px-5 py-4"><span className={`tag ${toneFor(item.paymentStatus)}`}>{item.paymentStatus}</span></td><td className="px-5 py-4">{item.cooperationIntent}</td><td className="px-5 py-4">{item.brandResult}</td><td className="px-5 py-4 text-xs text-[#7b6258]">{item.influencerRejectReason || item.brandRejectReason || "—"}</td><td className="px-5 py-4">{item.owner}</td><td className="px-5 py-4 font-medium">{money(item.feeCents)}</td></tr>;
            })}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const legalHolidayLabels: Record<string, string> = {
  "2026-01-01": "元旦",
  "2026-01-02": "元旦",
  "2026-01-03": "元旦",
  "2026-02-15": "春节",
  "2026-02-16": "春节",
  "2026-02-17": "春节",
  "2026-02-18": "春节",
  "2026-02-19": "春节",
  "2026-02-20": "春节",
  "2026-02-21": "春节",
  "2026-02-22": "春节",
  "2026-02-23": "春节",
  "2026-04-04": "清明节",
  "2026-04-05": "清明节",
  "2026-04-06": "清明节",
  "2026-05-01": "劳动节",
  "2026-05-02": "劳动节",
  "2026-05-03": "劳动节",
  "2026-05-04": "劳动节",
  "2026-05-05": "劳动节",
  "2026-06-19": "端午节",
  "2026-06-20": "端午节",
  "2026-06-21": "端午节",
  "2026-09-25": "中秋节",
  "2026-09-26": "中秋节",
  "2026-09-27": "中秋节",
  "2026-10-01": "国庆节",
  "2026-10-02": "国庆节",
  "2026-10-03": "国庆节",
  "2026-10-04": "国庆节",
  "2026-10-05": "国庆节",
  "2026-10-06": "国庆节",
  "2026-10-07": "国庆节",
};
const adjustedWorkdays = new Set(["2026-01-04", "2026-02-14", "2026-02-28", "2026-05-09", "2026-09-20", "2026-10-10"]);

function calendarDateKey(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function Calendar({ state, month }: { state: AppState; month: string }) {
  const items = state.collaborations.filter((c) => c.month === month);
  const [yearText, monthText] = month.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstDay = new Date(year, monthIndex, 1).getDay();
  const startOffset = (firstDay + 6) % 7;
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const weekDays = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  return (
    <div>
      <SectionTitle title="达人档期日历" action={<span className="text-sm text-[#687282]">发布与审核节点</span>} />
      <div className="card overflow-x-auto p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#687282]">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f0f7ff] px-2.5 py-1 text-[#2563eb]"><span className="h-2 w-2 rounded-full bg-[#60a5fa]" />周末</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4e5] px-2.5 py-1 text-[#c05621]"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />法定假期</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f5f9] px-2.5 py-1 text-[#64748b]"><span className="h-2 w-2 rounded-full bg-[#94a3b8]" />调休上班</span>
        </div>
        <div className="grid min-w-[860px] grid-cols-7 gap-px overflow-hidden rounded-xl bg-[#cbd5e1]">
          {weekDays.map((day, index) => <div className={`p-3 text-center text-xs font-medium ${index >= 5 ? "bg-[#eaf6ff] text-[#2563eb]" : "bg-[#f1f5f9] text-[#475569]"}`} key={day}>{day}</div>)}
          {Array.from({ length: totalCells }, (_, index) => {
            const day = index - startOffset + 1;
            if (day < 1 || day > daysInMonth) return <div key={`empty-${index}`} className="min-h-28 bg-[#eef2f7]" />;
            const key = calendarDateKey(year, monthIndex, day);
            const date = new Date(year, monthIndex, day);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const holiday = legalHolidayLabels[key];
            const isAdjusted = adjustedWorkdays.has(key);
            const dayEvents = items.filter((item) => Number(item.plannedPublishDate.slice(-2)) === day);
            const cellClass = holiday
              ? "bg-[#fffaf2]"
              : isWeekend && !isAdjusted
                ? "bg-[#f5fbff]"
                : "bg-white";
            return (
              <div key={key} className={`min-h-32 p-2 ${cellClass}`}>
                <div className="mb-2 flex min-h-5 items-center justify-between gap-2">
                  <span className={`text-xs font-medium ${holiday ? "text-[#c05621]" : isWeekend && !isAdjusted ? "text-[#2563eb]" : "text-[#687282]"}`}>{day}</span>
                  {holiday ? <span className="calendar-day-badge calendar-day-badge-holiday">{holiday}</span> : isAdjusted ? <span className="calendar-day-badge calendar-day-badge-adjusted">调休</span> : isWeekend ? <span className="calendar-day-badge calendar-day-badge-weekend">周末</span> : null}
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0, 3).map((event) => <div key={event.id} className={`truncate rounded-md border px-2 py-1 text-xs ${toneFor(event.status)}`}>{event.influencerName} · {event.status}</div>)}
                  {dayEvents.length > 3 ? <div className="text-xs text-[#687282]">还有 {dayEvents.length - 3} 项</div> : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ShippingSummaryPage({ state, month }: { state: AppState; month: string }) {
  const year = month.slice(0, 4);
  const items = state.collaborations.filter((c) => c.month.startsWith(`${year}-`)).map(normalizeShippingCollaboration);
  const shippingSummary = buildShippingProductSummary(items);
  const signedShipments = shippingSummary.rows.reduce((sum, row) => sum + row.signed, 0);
  const recoveredQuantity = shippingSummary.shipped.filter((item) => item.shippingStatus === "已签收").reduce((sum, item) => sum + (item.sampleQuantity || 1), 0);
  const totalCostCents = shippingSummary.shipped.reduce((sum, item) => sum + item.feeCents, 0);
  const recoveryRate = shippingSummary.totalQuantity ? Math.round(recoveredQuantity / shippingSummary.totalQuantity * 100) : 0;
  return (
    <div>
      <SectionTitle title="全年样品汇总" action={<span className="text-sm text-[#6f5d55]">按产品编码统计 {year} 年已寄出和已签收记录</span>} />
      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-[#7b6258]">全年邮寄数量统计</p><strong className="mt-2 block text-2xl text-[#f06d22]">{shippingSummary.totalShipments}</strong><span className="mt-1 block text-xs text-[#9aa3af]">已寄出单数</span></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">全年邮寄总数量</p><strong className="mt-2 block text-2xl text-[#2185a6]">{shippingSummary.totalQuantity}</strong><span className="mt-1 block text-xs text-[#9aa3af]">样品产品件数</span></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">成本统计</p><strong className="mt-2 block text-2xl text-[#7C6CEF]">{money(totalCostCents)}</strong><span className="mt-1 block text-xs text-[#9aa3af]">已寄出样品对应费用</span></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">回收统计</p><strong className="mt-2 block text-2xl text-[#c75bbd]">{recoveredQuantity}</strong><span className="mt-1 block text-xs text-[#9aa3af]">已签收样品数 · {recoveryRate}%</span></div>
      </section>
      <section className="card overflow-hidden">
        <div className="border-b border-[#ead8cd] px-5 py-4">
          <h3 className="font-medium">按产品编码汇总</h3>
          <p className="mt-1 text-xs text-[#7b6258]">每行聚合 {year} 年同一产品编码下的邮寄单、数量、签收状态、寄出人和快递单号；全年签收单数 {signedShipments}。</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[#fbf6f2] text-xs text-[#7b6258]"><tr><th className="px-5 py-3">产品编码</th><th className="px-5 py-3">样品内容</th><th className="px-5 py-3">寄出人</th><th className="px-5 py-3">邮寄单数</th><th className="px-5 py-3">产品数量</th><th className="px-5 py-3">签收/在途/异常</th><th className="px-5 py-3">快递单号</th></tr></thead>
            <tbody>{shippingSummary.rows.length ? shippingSummary.rows.map((row) => <tr key={row.code} className="border-t border-[#ead8cd]"><td className="px-5 py-4 font-medium">{row.code}</td><td className="px-5 py-4">{row.content}</td><td className="px-5 py-4">{row.senders.join("、") || "未填写"}</td><td className="px-5 py-4">{row.shipments}</td><td className="px-5 py-4">{row.quantity}</td><td className="px-5 py-4 text-xs text-[#6f5d55]">签收 {row.signed} / 在途 {row.inTransit} / 异常 {row.exception}</td><td className="max-w-sm truncate px-5 py-4 text-xs text-[#6f5d55]">{row.trackingNos.join("、") || "未填写"}</td></tr>) : <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-[#7b6258]">当前年份还没有已寄出的样品。</td></tr>}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Shipping({ state, setState, month }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; month: string }) {
  const items = state.collaborations.filter((c) => c.month === month).map(normalizeShippingCollaboration);
  const shippingSummary = buildShippingProductSummary(items);
  const groups: ShippingStatus[] = ["待寄出", "已寄出", "已签收"];
  const [editingShipment, setEditingShipment] = useState<Collaboration | null>(null);
  const [shippingMessage, setShippingMessage] = useState("");
  const [refreshingId, setRefreshingId] = useState<string | null>(null);

  const exportShippingData = async () => {
    const workbook = new ExcelJS.Workbook();
    const detail = workbook.addWorksheet("邮寄明细");
    detail.columns = ["月份", "达人", "合作节点", "物流状态", "运输状态", "样品内容", "产品编码", "样品数量", "快递公司", "快递单号", "寄出时间", "预计到达", "负责人", "备注", "最新轨迹"].map((header) => ({ header, key: header, width: 18 }));
    detail.addRows(items.map((item) => ({
      月份: item.month,
      达人: item.influencerName,
      合作节点: item.status,
      物流状态: item.shippingStatus,
      运输状态: transitStatusFor(item) || "",
      样品内容: item.sampleContent || "",
      产品编码: item.sampleProductCode || "",
      样品数量: item.sampleQuantity || 1,
      快递公司: item.courier || "",
      快递单号: item.trackingNo || "",
      寄出时间: item.shippedAt || "",
      预计到达: item.estimatedArrivalAt || "",
      负责人: item.owner,
      备注: item.shippingNote || "",
      最新轨迹: item.shipmentEvents?.at(-1)?.description || "",
    })));
    const summary = workbook.addWorksheet("产品汇总");
    summary.columns = ["产品编码", "样品内容", "寄出人", "邮寄单数", "产品数量", "已签收单数", "在途单数", "异常单数", "关联快递单号"].map((header) => ({ header, key: header, width: 20 }));
    summary.addRows(shippingSummary.rows.map((row) => ({
      产品编码: row.code,
      样品内容: row.content,
      寄出人: row.senders.join("、"),
      邮寄单数: row.shipments,
      产品数量: row.quantity,
      已签收单数: row.signed,
      在途单数: row.inTransit,
      异常单数: row.exception,
      关联快递单号: row.trackingNos.join("、"),
    })));
    const buffer = await workbook.xlsx.writeBuffer();
    try {
      const result = await exportWorkbookBuffer(buffer, `样品邮寄统计-${month}.xlsx`, state.settings?.exportDirectory);
      setShippingMessage(result.mode === "saved" ? `样品邮寄统计已保存到：${result.path}` : "样品邮寄统计已开始下载。");
    } catch (error) {
      setShippingMessage(`导出失败：${error instanceof Error ? error.message : "未知错误"}`);
    }
  };

  const createDraftShipment = () => {
    const id = `shipping-${crypto.randomUUID()}`;
    setEditingShipment({
      id,
      influencerId: id,
      influencerName: "新建邮寄记录",
      month,
      status: "样品寄送中",
      shippingStatus: "待寄出",
      paymentStatus: "未申请",
      owner: state.currentUser.name,
      feeCents: 0,
      plannedPublishDate: `${month}-01`,
      sampleContent: "",
      sampleQuantity: 1,
      sampleProductCode: "",
      cooperationIntent: "微信沟通/测品中",
      brandResult: "品牌/客户审核中",
    });
  };

  const saveShipment = async (input: { id: string; influencerName?: string; courier: string; trackingNo: string; shippingPhone?: string; shippedAt?: string; shippingNote?: string; sampleContent?: string; sampleQuantity?: number; sampleProductCode?: string }) => {
    setShippingMessage("");
    let events: ShipmentEvent[] = [];
    let trackingMode: "manual" | "realtime" = "manual";
    let canAutoTrack = false;
    let providerMessage = "";
    let queryFailed = false;
    try {
      const response = await fetch("/api/shipping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", courier: input.courier, trackingNo: input.trackingNo, phone: input.shippingPhone }) });
      const payload = (await response.json()) as ShippingApiResponse;
      if (!response.ok) {
        trackingMode = payload.mode || "manual";
        canAutoTrack = Boolean(payload.canAutoTrack);
        throw new Error(payload.providerMessage || payload.message || "物流查询失败");
      }
      events = payload.events || [];
      trackingMode = payload.mode || "manual";
      canAutoTrack = Boolean(payload.canAutoTrack);
      providerMessage = payload.message || "";
    } catch (error) {
      queryFailed = true;
      setShippingMessage(`真实物流查询未返回轨迹，已保存当前物流台账：${formatShippingFailureMessage(error instanceof Error ? error.message : "未知错误")}`);
    }
    const signed = canAutoTrack && hasSignedEvent(events);
    setState((s) => {
      const applyShipment = (c: Collaboration): Collaboration => ({ ...c, influencerName: input.influencerName?.trim() || c.influencerName, status: signed ? "达人初稿脚本中" : "样品寄送中", courier: input.courier, trackingNo: input.trackingNo, shippingPhone: input.shippingPhone, shippedAt: input.shippedAt, shippingNote: input.shippingNote, sampleContent: input.sampleContent || c.sampleContent, sampleQuantity: input.sampleQuantity || c.sampleQuantity, sampleProductCode: input.sampleProductCode || c.sampleProductCode, shippingStatus: signed ? "已签收" : "已寄出", trackingMode, trackingUpdatedAt: new Date().toISOString(), transitStatus: signed ? "已签收" : canAutoTrack ? "在途" : undefined, estimatedArrivalAt: signed || !canAutoTrack ? undefined : estimateArrivalText(input.shippedAt), shipmentEvents: events.length ? events : c.shipmentEvents });
      const exists = s.collaborations.some((c) => c.id === input.id);
      if (exists) return { ...s, collaborations: s.collaborations.map((c) => c.id === input.id ? applyShipment(c) : c) };
      const base: Collaboration = {
        id: input.id,
        influencerId: input.id,
        influencerName: input.influencerName?.trim() || "新建邮寄记录",
        month,
        status: "样品寄送中",
        shippingStatus: "待寄出",
        paymentStatus: "未申请",
        owner: s.currentUser.name,
        feeCents: 0,
        plannedPublishDate: `${month}-01`,
        sampleContent: input.sampleContent || "待填写样品",
        sampleQuantity: input.sampleQuantity || 1,
        sampleProductCode: input.sampleProductCode || "待填写编码",
        cooperationIntent: "微信沟通/测品中",
        brandResult: "品牌/客户审核中",
      };
      return { ...s, collaborations: [applyShipment(base), ...s.collaborations] };
    });
    if (signed) setShippingMessage("已识别签收，卡片已移动到“已签收”列。");
    else if (queryFailed) {
      setEditingShipment(null);
      return;
    }
    else if (!canAutoTrack) setShippingMessage("已保存物流信息，但当前未启用真实物流接口，所以不会刷新出真实轨迹；请配置快递鸟或快递100环境变量并重启服务。");
    else if (providerMessage) setShippingMessage(`${providerMessage}；当前仍未识别签收，卡片保留在“已寄出”列。`);
    setEditingShipment(null);
  };

  const refreshShipment = async (item: Collaboration) => {
    if (!item.trackingNo) return setShippingMessage("缺少快递单号，请先录入物流信息。");
    setRefreshingId(item.id);
    setShippingMessage("");
    try {
      const response = await fetch("/api/shipping", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "refresh", courier: item.courier, trackingNo: item.trackingNo, phone: item.shippingPhone }) });
      const payload = (await response.json()) as ShippingApiResponse;
      if (!response.ok) throw new Error(payload.providerMessage || payload.message || "物流查询失败");
      const events = payload.events || [];
      const canAutoTrack = Boolean(payload.canAutoTrack);
      const signed = canAutoTrack && hasSignedEvent(events);
      const exception = hasExceptionEvent(events);
      const mode = payload.mode || "manual";
      setState((s) => ({ ...s, collaborations: s.collaborations.map((c) => c.id === item.id ? { ...c, status: signed && c.status === "样品寄送中" ? "达人初稿脚本中" : c.status, shippingStatus: signed ? "已签收" : "已寄出", trackingMode: mode, trackingUpdatedAt: new Date().toISOString(), transitStatus: signed ? "已签收" : exception ? "异常" : canAutoTrack ? "在途" : undefined, estimatedArrivalAt: signed || !canAutoTrack ? undefined : c.estimatedArrivalAt || estimateArrivalText(c.shippedAt), shipmentEvents: events.length ? events : c.shipmentEvents } : c) }));
      setShippingMessage(signed ? "已识别签收，卡片已移动到“已签收”列。" : !canAutoTrack ? "当前未启用真实物流接口，刷新只会保留本地台账，不会返回真实轨迹；请配置快递鸟或快递100环境变量并重启服务。" : exception ? "物流轨迹存在异常，请跟进快递状态；当前仍未识别签收，卡片保留在“已寄出”列。" : `${payload.message || "物流已刷新"}；当前仍未识别签收，卡片保留在“已寄出”列。`);
    } catch (error) {
      setShippingMessage(`物流刷新未返回轨迹，已保留当前物流信息：${formatShippingFailureMessage(error instanceof Error ? error.message : "未知错误")}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const confirmReceipt = (item: Collaboration) => {
    const event = { time: new Date().toLocaleString("zh-CN", { hour12: false }), description: "已人工确认签收" };
    setState((s) => ({ ...s, collaborations: s.collaborations.map((c) => c.id === item.id ? { ...c, status: c.status === "样品寄送中" ? "达人初稿脚本中" : c.status, shippingStatus: "已签收", transitStatus: "已签收", estimatedArrivalAt: undefined, trackingUpdatedAt: new Date().toISOString(), shipmentEvents: [...(c.shipmentEvents || []), event] } : c) }));
    setShippingMessage(`${item.influencerName} 已人工确认签收。`);
  };

  return (
    <div>
      <SectionTitle title="达人邮寄数据" action={<div className="flex items-center gap-2"><span className="hidden text-sm text-[#6f5d55] sm:inline">按物流状态分组</span><button className="btn px-3 py-2 text-xs" onClick={createDraftShipment}><IconCirclePlus size={15} />新建邮寄</button><button className="btn px-3 py-2 text-xs" onClick={exportShippingData}><IconDownload size={15} />导出邮寄表</button></div>} />
      {shippingMessage && <p className="mb-4 rounded-xl border border-[#f8c8ab] bg-[#fee8d9] p-3 text-xs text-[#9a3c0f]">{shippingMessage}</p>}
      <section className="mb-4 grid gap-3 md:grid-cols-4">
        <div className="card p-4"><p className="text-xs text-[#7b6258]">已邮寄单数</p><strong className="mt-2 block text-2xl text-[#f06d22]">{shippingSummary.totalShipments}</strong></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">产品总数量</p><strong className="mt-2 block text-2xl text-[#2185a6]">{shippingSummary.totalQuantity}</strong></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">样品种类</p><strong className="mt-2 block text-2xl text-[#87933c]">{shippingSummary.sampleKinds}</strong></div>
        <div className="card p-4"><p className="text-xs text-[#7b6258]">产品编码数</p><strong className="mt-2 block text-2xl text-[#c75bbd]">{shippingSummary.productCodeCount}</strong></div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        {groups.map((group) => {
          const groupItems = items.filter((i) => i.shippingStatus === group);
          return (
            <section key={group} className="rounded-2xl bg-[#f4e9e2] p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="font-medium">{group}</h3>
                <span className={`tag ${toneFor(group)}`}>{groupItems.length}</span>
              </div>
              <div className="space-y-3">
                {groupItems.map((item) => {
                  const transit = transitStatusFor(item);
                  return (
                    <article key={item.id} className="card bg-white p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <strong>{item.influencerName}</strong>
                        <span className={`tag ${toneFor(item.shippingStatus)}`}>{item.shippingStatus}</span>
                      </div>
                      <dl className="grid gap-2 text-xs text-[#6f5d55]">
                        <div>合作节点：{item.status}</div>
                        <div>达人类型：{state.influencers.find((i) => i.id === item.influencerId)?.type}</div>
                        <div>样品内容：{item.sampleContent || "待填写"}</div>
                        <div>产品编码：{item.sampleProductCode || "待填写"}</div>
                        <div>样品数量：{item.sampleQuantity || 1} 件</div>
                        <div>负责人：{item.owner}</div>
                        <div>快递：{item.courier || "待填写"} {item.trackingNo}</div>
                        {group === "已寄出" && <div>物流模式：{item.trackingMode === "realtime" ? "物流接口真实查询" : "未启用真实物流接口"}</div>}
                        {item.trackingUpdatedAt && <div>更新时间：{new Date(item.trackingUpdatedAt).toLocaleString("zh-CN", { hour12: false })}</div>}
                        {transit && group === "已寄出" && <div>运输状态：<span className={`tag ${transit === "异常" ? "tag-rose" : "tag-cyan"}`}>{transit}</span></div>}
                        {group === "已寄出" && <div>预计到达：{item.trackingMode === "realtime" && item.estimatedArrivalAt ? item.estimatedArrivalAt : "点击刷新物流后查询真实轨迹"}</div>}
                        {item.shippedAt && <div>寄出时间：{item.shippedAt}</div>}
                        {item.shippingNote && <div>备注：{item.shippingNote}</div>}
                      </dl>
                      {item.shipmentEvents?.length ? <p className="mt-3 rounded-lg bg-[#f8f0ec] px-3 py-2 text-xs text-[#6f5d55]">最新轨迹：{item.shipmentEvents[item.shipmentEvents.length - 1].description}</p> : null}
                      {group === "待寄出" && <button onClick={() => setEditingShipment(item)} className="btn mt-4 w-full text-xs">录入物流信息</button>}
                      {group === "已寄出" && <div className="mt-4 grid gap-2 sm:grid-cols-2"><button onClick={() => refreshShipment(item)} className="btn w-full text-xs" disabled={refreshingId === item.id}>{refreshingId === item.id ? "刷新中..." : "刷新物流"}</button><button onClick={() => confirmReceipt(item)} className="btn w-full border-[#c7d3a0] bg-[#f1f6d1] text-[#424434] text-xs">确认签收</button></div>}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      {editingShipment && <ShipmentModal item={editingShipment} onClose={() => setEditingShipment(null)} onSave={saveShipment} />}
    </div>
  );
}

function ShipmentModal({ item, onClose, onSave }: { item: Collaboration; onClose: () => void; onSave: (input: { id: string; influencerName?: string; courier: string; trackingNo: string; shippingPhone?: string; shippedAt?: string; shippingNote?: string; sampleContent?: string; sampleQuantity?: number; sampleProductCode?: string }) => Promise<void> }) {
  const [influencerName, setInfluencerName] = useState(item.influencerName || "");
  const [courier, setCourier] = useState(item.courier || "");
  const [trackingNo, setTrackingNo] = useState(item.trackingNo || "");
  const [detectedCourier, setDetectedCourier] = useState<string | null>(item.trackingNo ? detectCourierByTrackingNo(item.trackingNo) : null);
  const [shippingPhone, setShippingPhone] = useState(item.shippingPhone || "");
  const [sampleContent, setSampleContent] = useState(item.sampleContent || "");
  const [sampleQuantity, setSampleQuantity] = useState(String(item.sampleQuantity || 1));
  const [sampleProductCode, setSampleProductCode] = useState(item.sampleProductCode || "");
  const [shippingNote, setShippingNote] = useState(item.shippingNote || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!influencerName.trim()) return setError("请填写达人名称。");
    if (!courier.trim()) return setError("请选择或填写快递公司。");
    if (trackingNo.trim().length < 5) return setError("快递单号至少 5 位。");
    setSaving(true);
    await onSave({ id: item.id, influencerName: influencerName.trim(), courier: courier.trim(), trackingNo: trackingNo.trim(), shippingPhone: shippingPhone.trim() || undefined, shippedAt: item.shippedAt || new Date().toLocaleString("zh-CN", { hour12: false }), shippingNote: shippingNote.trim() || undefined, sampleContent: sampleContent.trim() || undefined, sampleQuantity: Math.max(1, Number(sampleQuantity || 1)), sampleProductCode: sampleProductCode.trim() || undefined });
    setSaving(false);
  };
  const updateTrackingNo = (value: string) => {
    setTrackingNo(value);
    const detected = detectCourierByTrackingNo(value);
    setDetectedCourier(detected);
    if (detected) setCourier(detected);
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4">
      <form onSubmit={submit} className="card w-full max-w-lg bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">录入物流信息</h2>
            <p className="mt-1 text-sm text-[#687282]">{item.influencerName} · {item.owner}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><IconX /></button>
        </div>
        <div className="grid gap-4">
          <label className="text-sm">达人名称<input className="control mt-2 w-full" value={influencerName} onChange={(e) => setInfluencerName(e.target.value)} placeholder="填写达人名称或昵称" required /></label>
          <label className="text-sm">样品内容<input className="control mt-2 w-full" value={sampleContent} onChange={(e) => setSampleContent(e.target.value)} placeholder="例如 花再香氛礼盒" /></label>
          <label className="text-sm">产品编码<input className="control mt-2 w-full" value={sampleProductCode} onChange={(e) => setSampleProductCode(e.target.value)} placeholder="例如 HZ-FR-001" /></label>
          <label className="text-sm">样品数量<input className="control mt-2 w-full" type="number" min={1} value={sampleQuantity} onChange={(e) => setSampleQuantity(e.target.value)} /></label>
          <label className="text-sm">快递单号<input className="control mt-2 w-full" value={trackingNo} onChange={(e) => updateTrackingNo(e.target.value)} placeholder="例如 SF202606180001" required minLength={5} /></label>
          <label className="text-sm">快递公司<select className="control mt-2 w-full" value={courier} onChange={(e) => setCourier(e.target.value)} required><option value="">填写单号后自动识别，也可手动选择</option><option>顺丰速运</option><option>中通快递</option><option>圆通速递</option><option>韵达快递</option><option>京东物流</option><option>申通快递</option><option>极兔速递</option><option>EMS</option><option>德邦快递</option></select>{detectedCourier && <span className="mt-2 block text-xs text-[#2185a6]">已根据单号识别为：{detectedCourier}</span>}</label>
          <label className="text-sm">查询手机号/后四位<input className="control mt-2 w-full" value={shippingPhone} onChange={(e) => setShippingPhone(e.target.value)} placeholder="顺丰、中通查询时常用，可选" /></label>
          <label className="text-sm">备注<textarea className="control mt-2 min-h-20 w-full py-2" value={shippingNote} onChange={(e) => setShippingNote(e.target.value)} placeholder="可记录收件人、异常说明等" /></label>
        </div>
        {error && <p className="mt-4 rounded-xl border border-[#fecdd3] bg-[#fff1f2] p-3 text-xs text-[#9f1239]">{error}</p>}
        <div className="mt-7 flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "保存中..." : "保存并标记寄出"}</button>
        </div>
      </form>
    </div>
  );
}

function CollaborationForm({ state, month, onClose, onSave }: { state: AppState; month: string; onClose: () => void; onSave: (collaboration: Collaboration) => void }) {
  const firstInfluencer = state.influencers[0];
  const [influencerId, setInfluencerId] = useState(firstInfluencer?.id || "manual");
  const selectedInfluencer = state.influencers.find((item) => item.id === influencerId);
  const [influencerName, setInfluencerName] = useState(firstInfluencer?.name || "");
  const [status, setStatus] = useState<CollaborationStatus>("样品寄送中");
  const [shippingStatus, setShippingStatus] = useState<ShippingStatus>("待寄出");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("未申请");
  const [owner, setOwner] = useState(state.currentUser.name);
  const [feeYuan, setFeeYuan] = useState("0");
  const [plannedPublishDate, setPlannedPublishDate] = useState(`${month}-15`);
  const [sampleContent, setSampleContent] = useState("");
  const [sampleProductCode, setSampleProductCode] = useState("");
  const [sampleQuantity, setSampleQuantity] = useState("1");
  const [cooperationIntent, setCooperationIntent] = useState<Collaboration["cooperationIntent"]>("微信沟通/测品中");
  const [influencerRejectReason, setInfluencerRejectReason] = useState("");
  const [brandResult, setBrandResult] = useState<Collaboration["brandResult"]>("品牌/客户审核中");
  const [brandRejectReason, setBrandRejectReason] = useState("");
  const syncInfluencer = (id: string) => {
    setInfluencerId(id);
    const influencer = state.influencers.find((item) => item.id === id);
    if (influencer) setInfluencerName(influencer.name);
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const now = Date.now();
    const name = influencerName.trim();
    if (!name) return;
    onSave({
      id: `col-${now}`,
      influencerId: selectedInfluencer?.id || `manual-${now}`,
      influencerName: name,
      month,
      status,
      shippingStatus,
      paymentStatus,
      owner: owner.trim() || state.currentUser.name,
      feeCents: Math.max(0, Math.round(Number(feeYuan || 0) * 100)),
      plannedPublishDate: plannedPublishDate || `${month}-15`,
      sampleContent: sampleContent.trim() || undefined,
      sampleProductCode: sampleProductCode.trim() || undefined,
      sampleQuantity: Math.max(1, Number(sampleQuantity || 1)),
      cooperationIntent,
      influencerRejectReason: influencerRejectReason.trim() || undefined,
      brandResult,
      brandRejectReason: brandRejectReason.trim() || undefined,
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="card flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden bg-white">
        <div className="flex items-center justify-between border-b border-[#E3E6EC] p-5">
          <div>
            <h2 className="text-xl font-semibold">新增达人合作</h2>
            <p className="mt-1 text-sm text-[#757A84]">用于录入本月达人合作费用、节点、结款和建联分析数据。</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭"><IconX /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-auto p-5">
          <section className="grid gap-4 rounded-2xl border border-white/80 bg-[#FAFAFC] p-4 md:grid-cols-2">
            <label className="text-sm">选择达人<select className="control mt-2 w-full" value={influencerId} onChange={(event) => syncInfluencer(event.target.value)}><option value="manual">临时手动录入</option>{state.influencers.map((influencer) => <option key={influencer.id} value={influencer.id}>{influencer.name}</option>)}</select></label>
            <label className="text-sm">达人名称<input className="control mt-2 w-full" value={influencerName} onChange={(event) => { setInfluencerId("manual"); setInfluencerName(event.target.value); }} required /></label>
            <label className="text-sm">负责人<input className="control mt-2 w-full" value={owner} onChange={(event) => setOwner(event.target.value)} /></label>
            <label className="text-sm">合作费用（元）<input className="control mt-2 w-full" type="number" min={0} value={feeYuan} onChange={(event) => setFeeYuan(event.target.value)} /></label>
            <label className="text-sm">计划发布日期<input className="control mt-2 w-full" type="date" value={plannedPublishDate} onChange={(event) => setPlannedPublishDate(event.target.value)} /></label>
            <label className="text-sm">合作节点<select className="control mt-2 w-full" value={status} onChange={(event) => setStatus(event.target.value as CollaborationStatus)}>{statusOrder.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm">邮寄状态<select className="control mt-2 w-full" value={shippingStatus} onChange={(event) => setShippingStatus(event.target.value as ShippingStatus)}>{shippingStatusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm">付款状态<select className="control mt-2 w-full" value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as PaymentStatus)}>{paymentStatusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          </section>
          <section className="grid gap-4 rounded-2xl border border-white/80 bg-[#FAFAFC] p-4 md:grid-cols-3">
            <label className="text-sm">样品内容<input className="control mt-2 w-full" value={sampleContent} onChange={(event) => setSampleContent(event.target.value)} placeholder="可选" /></label>
            <label className="text-sm">产品编码<input className="control mt-2 w-full" value={sampleProductCode} onChange={(event) => setSampleProductCode(event.target.value)} placeholder="可选" /></label>
            <label className="text-sm">样品数量<input className="control mt-2 w-full" type="number" min={1} value={sampleQuantity} onChange={(event) => setSampleQuantity(event.target.value)} /></label>
          </section>
          <section className="grid gap-4 rounded-2xl border border-white/80 bg-[#FAFAFC] p-4 md:grid-cols-2">
            <label className="text-sm">合作意向<select className="control mt-2 w-full" value={cooperationIntent} onChange={(event) => setCooperationIntent(event.target.value as Collaboration["cooperationIntent"])}>{cooperationIntentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm">达人拒绝原因<input className="control mt-2 w-full" value={influencerRejectReason} onChange={(event) => setInfluencerRejectReason(event.target.value)} placeholder="没有则留空" /></label>
            <label className="text-sm">提报结果<select className="control mt-2 w-full" value={brandResult} onChange={(event) => setBrandResult(event.target.value as Collaboration["brandResult"])}>{brandResultOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-sm">品牌/客户拒绝原因<input className="control mt-2 w-full" value={brandRejectReason} onChange={(event) => setBrandRejectReason(event.target.value)} placeholder="没有则留空" /></label>
          </section>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E3E6EC] p-5">
          <button type="button" className="btn" onClick={onClose}>取消</button>
          <button type="submit" className="btn btn-primary">保存合作</button>
        </div>
      </form>
    </div>
  );
}

function Monthly({ state, setState, month }: { state: AppState; setState: React.Dispatch<React.SetStateAction<AppState>>; month: string }) {
  const [showAddCollaboration, setShowAddCollaboration] = useState(false);
  const items = state.collaborations.filter((c) => c.month === month);
  const monthBudgetCents = getMonthBudgetCents(state, month);
  const a = getAnalytics(items, monthBudgetCents, { averageCents: getMonthAverageCents(state, month) });
  const projectProgress = getMonthProjectProgress(state, month);
  const move = (id: string, status: CollaborationStatus) => setState((s) => ({ ...s, collaborations: s.collaborations.map((c) => c.id === id ? { ...c, status } : c) }));
  return (
    <div className="space-y-8">
      <section>
        <SectionTitle title="达人花费数据" action={<button type="button" className="btn btn-primary" onClick={() => setShowAddCollaboration(true)}><IconCirclePlus size={18} />新增合作</button>} />
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="达人花费" value={money(a.spendCents)} note={`${items.length} 位达人`} tone={0} />
          <Metric label="达人均价" value={money(a.averageCents)} note="按本月合作计算" tone={1} />
          <div className="card p-5">
            <p className="text-sm text-[#757A84]">预算花费进度</p>
            <strong className="mt-5 block text-4xl text-[#7C6CEF]">{a.budgetPercent}%</strong>
            <div className="mt-5">
              <Progress value={a.budgetPercent} />
              <p className="mt-2 text-xs text-[#757A84]">当前 {money(a.spendCents)} / 目标 {money(monthBudgetCents)}</p>
            </div>
          </div>
        </div>
      </section>
      <ProjectRechargeProgress projects={projectProgress} executionPercent={a.executionPercent} progressed={a.progressed} target={a.executionTarget} onSave={(projects) => setState((current) => saveMonthProjectProgress(current, month, projects))} />
      <section>
        <SectionTitle title="达人进度一览" />
        <div className="grid gap-4">
          <ChartCard title={`${Number(month.slice(5))}月达人合作进度`}><BarChart data={groupCount(items, "status")} height={310} /></ChartCard>
        </div>
      </section>
      <section>
        <SectionTitle title="合作流程看板" action={<span className="text-xs text-[#757A84]">拖动卡片可更新状态</span>} />
        <div className="flex gap-3 overflow-x-auto pb-3">
          {statusOrder.map((status) => (
            <div key={status} onDragOver={(e) => e.preventDefault()} onDrop={(e) => move(e.dataTransfer.getData("id"), status)} className="w-72 shrink-0 rounded-2xl border border-white/80 bg-[#FAFAFC] p-3 shadow-[inset_2px_2px_5px_rgba(255,255,255,.88),inset_-3px_-3px_7px_rgba(206,211,220,.30)]">
              <div className="mb-3 flex items-center justify-between"><span className="text-sm font-medium text-[#26272D]">{status}</span><span className={`tag ${toneFor(status)}`}>{items.filter((i) => i.status === status).length}</span></div>
              <div className="space-y-2">
                {items.filter((i) => i.status === status).map((item) => <article draggable onDragStart={(e) => e.dataTransfer.setData("id", item.id)} key={item.id} className="card bg-white p-3 text-sm"><strong>{item.influencerName}</strong><p className="mt-2 text-xs text-[#757A84]">{item.owner} · {money(item.feeCents)}</p><p className="mt-1 text-xs text-[#757A84]">计划发布 {item.plannedPublishDate.slice(5)}</p></article>)}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section>
        <SectionTitle title="达人结款数据" />
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="付款情况"><PieChart data={groupCount(items, "paymentStatus")} /></ChartCard>
          <ChartCard title="返点情况"><PieChart data={[{ name: "未返点", value: 15 }, { name: "已返点", value: 13 }]} /></ChartCard>
          <ChartCard title="返图情况"><PieChart data={[{ name: "已上传", value: 22 }, { name: "空缺", value: 11 }]} /></ChartCard>
        </div>
      </section>
      {showAddCollaboration && <CollaborationForm state={state} month={month} onClose={() => setShowAddCollaboration(false)} onSave={(collaboration) => { setState((current) => ({ ...current, collaborations: [collaboration, ...current.collaborations] })); setShowAddCollaboration(false); }} />}
    </div>
  );
}

function Analytics({ state, month, onDrilldown }: { state: AppState; month: string; onDrilldown: (filter: DrilldownFilter) => void }) {
  const items = state.collaborations.filter((c) => c.month === month);
  const rejection = groupCount(items.filter((i) => i.influencerRejectReason), "influencerRejectReason");
  const brand = groupCount(items.filter((i) => i.brandRejectReason), "brandRejectReason");
  return <div className="space-y-8"><section><SectionTitle title="达人侧" /><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="达人合作意向分布"><PieChart data={groupCount(items, "cooperationIntent")} height={330} onItemClick={(value) => onDrilldown({ field: "cooperationIntent", value, title: "达人合作意向" })} /></ChartCard><ChartCard title="达人拒单原因分布"><WordCloud data={rejection} onItemClick={(value) => onDrilldown({ field: "influencerRejectReason", value, title: "达人拒单原因" })} /></ChartCard></div></section><section><SectionTitle title="品牌侧" /><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="提报结果分布"><PieChart data={groupCount(items, "brandResult")} height={330} onItemClick={(value) => onDrilldown({ field: "brandResult", value, title: "品牌提报结果" })} /></ChartCard><ChartCard title="品牌拒绝原因分布"><WordCloud data={brand} onItemClick={(value) => onDrilldown({ field: "brandRejectReason", value, title: "品牌拒绝原因" })} /></ChartCard></div></section></div>;
}

function WordCloud({ data, onItemClick }: { data: { name: string; value: number }[]; onItemClick?: (name: string) => void }) {
  const colors = ["#7C6CEF", "#A38CF5", "#F29A57", "#37D6A5", "#D8CDFB", "#B2B8C2"];
  const repeated = [...data.map((d) => ({ ...d, clickable: true })), ...data.map((d, i) => ({ ...d, name: ["数据表现偏弱", "不接急单", "档期冲突", "内容质量一般", "调性不符"][i % 5], clickable: false }))];
  return <div className="flex min-h-[330px] flex-wrap content-center items-center justify-center gap-x-5 gap-y-3 p-7">{repeated.map((d, i) => <button type="button" key={`${d.name}-${i}`} onClick={() => d.clickable && onItemClick?.(d.name)} className={d.clickable && onItemClick ? "rounded-lg px-1 hover:bg-[#fff4ed]" : "cursor-default"} style={{ color: colors[i % colors.length], fontSize: `${15 + d.value * 5 + (i % 3) * 4}px`, fontWeight: i % 3 === 0 ? 700 : 500 }}>{d.name}</button>)}</div>;
}

function Team({ state }: { state: AppState }) {
  return <div><SectionTitle title="团队与权限" action={<button className="btn btn-primary"><IconCirclePlus size={18} />邀请成员</button>} /><div className="grid gap-4 md:grid-cols-2"><TeamMember initial="梁" name={state.currentUser.name} email="admin@example.com" role="管理员" dark /><TeamMember initial="林" name="林琪" email="lin@example.com" role="成员" /></div></div>;
}

function TeamMember({ initial, name, email, role, dark }: { initial: string; name: string; email: string; role: string; dark?: boolean }) {
  return <div className="card p-5"><div className="flex items-center gap-4"><div className={`grid h-12 w-12 place-items-center rounded-full font-semibold ${dark ? "bg-[#593229] text-white" : "bg-[#fee8d9] text-[#a23c0f]"}`}>{initial}</div><div><strong>{name}</strong><p className="text-sm text-[#7b6258]">{email}</p></div><span className={`tag ml-auto ${role === "管理员" ? "tag-violet" : "tag-cyan"}`}>{role}</span></div></div>;
}

function AddInfluencer({ onClose, onSave }: { onClose: () => void; onSave: (value: Influencer) => void }) {
  return <InfluencerForm title="新增达人" onClose={onClose} onSave={onSave} />;
}

function InfluencerForm({ title, initial, onClose, onSave }: { title: string; initial?: Influencer; onClose: () => void; onSave: (value: Influencer) => void }) {
  const accounts = initial ? accountList(initial) : [{ id: crypto.randomUUID(), platform: "小红书" as const, handle: "", url: "", followers: 0 }];
  const inferredProvince = inferProvinceByCity(initial?.city || "") || "江苏";
  const [province, setProvince] = useState(inferredProvince);
  const [city, setCity] = useState(initial?.city || provinceCities[inferredProvince][0]);
  const cityOptions = provinceCities[province].includes(city) ? provinceCities[province] : [city, ...provinceCities[province]];
  const [selectedTags, setSelectedTags] = useState<string[]>(initial?.tags || []);
  const [customTag, setCustomTag] = useState("");
  const [accountRows, setAccountRows] = useState(accounts.map((a) => ({ ...a, id: a.id || crypto.randomUUID() })));
  const toggleTag = (tag: string) => setSelectedTags((tags) => tags.includes(tag) ? tags.filter((item) => item !== tag) : [...tags, tag]);
  const addCustomTag = () => {
    const next = customTag.trim();
    if (!next) return;
    setSelectedTags((tags) => tags.includes(next) ? tags : [...tags, next]);
    setCustomTag("");
  };
  const updateAccount = (id: string, patch: Partial<(typeof accountRows)[number]>) => setAccountRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const addAccount = () => setAccountRows((rows) => [...rows, { id: crypto.randomUUID(), platform: "小红书" as const, handle: "", url: "", followers: 0 }]);
  const removeAccount = (id: string) => setAccountRows((rows) => rows.length === 1 ? rows : rows.filter((row) => row.id !== id));
  const submit = (form: FormData) => {
    const parsedAccounts = accountRows.map((row) => ({ ...row, handle: row.handle.trim(), url: row.url.trim() || profileSearchUrl(row.platform, row.handle), followers: Number(row.followers || 0) })).filter((row) => row.handle || row.url);
    const primary = parsedAccounts[0] || { id: crypto.randomUUID(), platform: "小红书" as const, handle: "", url: "", followers: 0 };
    onSave({
      id: initial?.id || crypto.randomUUID(),
      name: String(form.get("name") || "").trim(),
      handle: primary.handle,
      platform: primary.platform,
      platformAccounts: parsedAccounts,
      type: String(form.get("type") || "待分类").trim(),
      city,
      followers: primary.followers,
      quoteCents: Math.round(Number(form.get("quote") || 0) * 100),
      phone: String(form.get("phone") || "").trim(),
      tags: selectedTags,
      notes: String(form.get("notes") || "").trim(),
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-3">
      <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)); }} className="card flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden bg-white">
        <div className="flex shrink-0 items-start justify-between border-b border-[#e5e7eb] p-5"><div><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-[#687282]">支持一个达人绑定多个平台账号，账号链接可直接跳转。</p></div><button type="button" onClick={onClose} aria-label="关闭"><IconX /></button></div>
        <div className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">达人名称<input required name="name" defaultValue={initial?.name || ""} className="control mt-2 w-full" /></label>
          <label className="text-sm">达人类型<input name="type" list="influencer-type-options" defaultValue={initial?.type || ""} className="control mt-2 w-full" placeholder="选择常规类型或自定义填写" /><datalist id="influencer-type-options">{influencerTypes.map((type) => <option value={type} key={type} />)}</datalist></label>
          <label className="text-sm">省份<select className="control mt-2 w-full" value={province} onChange={(e) => { setProvince(e.target.value); setCity(provinceCities[e.target.value][0]); }}>{Object.keys(provinceCities).map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">城市<select className="control mt-2 w-full" value={city} onChange={(e) => setCity(e.target.value)}>{cityOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="text-sm">参考报价（元）<input name="quote" type="number" min={0} defaultValue={initial ? initial.quoteCents / 100 : ""} className="control mt-2 w-full" /></label>
          <label className="text-sm">联系方式<input name="phone" defaultValue={initial?.phone || ""} className="control mt-2 w-full" /></label>
        </div>
        <section className="rounded-2xl border border-[#e5e7eb] bg-[#f8fafc] p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-medium">标签</h3><span className="text-xs text-[#687282]">按内容、配合度、评估选择，也可自定义</span></div>
          <div className="space-y-3">{tagGroups.map((group) => <div key={group.title}><p className="mb-2 text-xs font-medium text-[#687282]">{group.title}</p><div className="flex flex-wrap gap-2">{group.options.map((tag) => <button type="button" key={tag} onClick={() => toggleTag(tag)} className={`tag ${selectedTags.includes(tag) ? toneFor(tag) : "bg-white text-[#475569] ring-1 ring-[#e5e7eb]"}`}>{tag}</button>)}</div></div>)}</div>
          <div className="mt-3 flex gap-2"><input className="control flex-1" value={customTag} onChange={(e) => setCustomTag(e.target.value)} placeholder="输入自定义标签" /><button type="button" className="btn" onClick={addCustomTag}>添加</button></div>
          {selectedTags.length ? <div className="mt-3 flex flex-wrap gap-2">{selectedTags.map((tag) => <button type="button" key={tag} onClick={() => toggleTag(tag)} className={`tag ${toneFor(tag)}`}>{tag} ×</button>)}</div> : null}
        </section>
        <section className="rounded-2xl border border-[#e5e7eb] bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><h3 className="font-medium">平台账号</h3><button type="button" className="btn px-3 py-2 text-xs" onClick={addAccount}><IconCirclePlus size={15} />添加账号</button></div>
          <div className="space-y-3">{accountRows.map((row, index) => <div key={row.id} className="rounded-xl bg-[#f8fafc] p-3"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-medium text-[#687282]">账号 {index + 1}</span><button type="button" className="grid h-8 w-8 place-items-center rounded-lg border border-[#fee2e2] text-[#be123c] hover:bg-[#fff1f2]" onClick={() => removeAccount(row.id)} title="删除账号"><IconTrash size={14} /></button></div><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-[#687282]">平台<select className="control mt-1 w-full" value={row.platform} onChange={(e) => updateAccount(row.id, { platform: e.target.value as Influencer["platform"] })}>{platforms.map((platform) => <option key={platform}>{platform}</option>)}</select></label><label className="text-xs text-[#687282]">平台账号<input className="control mt-1 w-full" value={row.handle} onChange={(e) => updateAccount(row.id, { handle: e.target.value })} placeholder="@账号或昵称" /></label><label className="text-xs text-[#687282] sm:col-span-2">平台链接<input className="control mt-1 w-full" value={row.url} onChange={(e) => updateAccount(row.id, { url: e.target.value })} placeholder="https://..." /></label><label className="text-xs text-[#687282]">粉丝数<input className="control mt-1 w-full" type="number" min={0} value={row.followers} onChange={(e) => updateAccount(row.id, { followers: Number(e.target.value) })} placeholder="粉丝数" /></label></div></div>)}</div>
        </section>
        <label className="block text-sm">备注<textarea name="notes" defaultValue={initial?.notes || ""} className="control mt-2 min-h-20 w-full py-2" placeholder="合作偏好、内容方向、历史沟通信息等" /></label>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[#e5e7eb] bg-white/95 p-4"><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn btn-primary" type="submit">保存达人</button></div>
      </form>
    </div>
  );
}
