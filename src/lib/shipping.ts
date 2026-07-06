import { createHash } from "node:crypto";
import type { ShipmentEvent } from "./types";

export interface TrackingOptions {
  courier?: string;
  phone?: string;
}

export interface ShippingProvider {
  createTracking(courier: string, trackingNo: string, options?: TrackingOptions): Promise<ShipmentEvent[]>;
  refreshTracking(trackingNo: string, options?: TrackingOptions): Promise<ShipmentEvent[]>;
  handleWebhook(payload: unknown): Promise<void>;
}

export type ShippingProviderName = "mock" | "kuaidi100" | "kdniao";

export type ShippingModeInfo = {
  provider: ShippingProviderName;
  mode: "manual" | "realtime";
  canAutoTrack: boolean;
  requiresManualConfirm: boolean;
  message: string;
};

const COURIER_CODE_MAP: Record<string, string> = {
  顺丰速运: "shunfeng",
  顺丰: "shunfeng",
  SF: "shunfeng",
  中通快递: "zhongtong",
  中通: "zhongtong",
  圆通速递: "yuantong",
  圆通: "yuantong",
  韵达快递: "yunda",
  韵达: "yunda",
  京东物流: "jd",
  京东: "jd",
  申通快递: "shentong",
  申通: "shentong",
  极兔速递: "jtexpress",
  极兔: "jtexpress",
  EMS: "ems",
  ems: "ems",
  德邦快递: "debangwuliu",
  德邦: "debangwuliu",
};

const KDNIAO_COURIER_CODE_MAP: Record<string, string> = {
  顺丰速运: "SF",
  顺丰: "SF",
  SF: "SF",
  中通快递: "ZTO",
  中通: "ZTO",
  圆通速递: "YTO",
  圆通: "YTO",
  韵达快递: "YD",
  韵达: "YD",
  京东物流: "JD",
  京东: "JD",
  申通快递: "STO",
  申通: "STO",
  极兔速递: "JTSD",
  极兔: "JTSD",
  EMS: "EMS",
  ems: "EMS",
  德邦快递: "DBL",
  德邦: "DBL",
};

type Kuaidi100Trace = {
  time?: string;
  ftime?: string;
  context?: string;
  status?: string;
  areaName?: string;
};

type Kuaidi100Response = {
  message?: string;
  state?: string;
  status?: string;
  condition?: string;
  data?: Kuaidi100Trace[];
};

type Kuaidi100AutoDetectResponse = {
  auto?: { comCode?: string; noCount?: number; noPre?: string }[];
};

type KdniaoTrace = {
  AcceptTime?: string;
  AcceptStation?: string;
  Location?: string;
};

type KdniaoResponse = {
  Success?: boolean;
  Reason?: string;
  State?: string;
  StateEx?: string;
  Traces?: KdniaoTrace[];
};

function normalizeCourierCode(courier: string) {
  const trimmed = courier.trim();
  if (COURIER_CODE_MAP[trimmed]) return COURIER_CODE_MAP[trimmed];
  if (/^[a-z0-9_-]+$/i.test(trimmed)) return trimmed.toLowerCase();
  throw new Error(`暂不支持该快递公司：${courier}`);
}

function normalizeKdniaoCourierCode(courier: string) {
  const trimmed = courier.trim();
  if (KDNIAO_COURIER_CODE_MAP[trimmed]) return KDNIAO_COURIER_CODE_MAP[trimmed];
  if (/^[a-z0-9_-]+$/i.test(trimmed)) return trimmed.toUpperCase();
  throw new Error(`快递鸟暂不支持该快递公司：${courier}`);
}

function md5(value: string) {
  return createHash("md5").update(value, "utf8").digest("hex").toUpperCase();
}

function base64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function nowText() {
  return new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

export class MockShippingProvider implements ShippingProvider {
  async createTracking(courier: string, trackingNo: string) {
    return [
      { time: nowText(), description: `已保存物流信息：${courier} ${trackingNo}` },
      { time: nowText(), description: "本地手工模式不自动查询真实物流轨迹，请人工维护或配置快递100。" },
    ];
  }

  async refreshTracking(trackingNo: string, options?: TrackingOptions) {
    const courier = options?.courier || "快递公司";
    return [
      { time: nowText(), description: `已保存物流信息：${courier} ${trackingNo}` },
      { time: nowText(), description: "本地手工模式不自动查询真实物流轨迹，请人工刷新供应商系统或手工确认签收。" },
    ];
  }

  async handleWebhook() {
    return;
  }
}

export class Kuaidi100Provider implements ShippingProvider {
  private readonly customer: string;
  private readonly key: string;
  private readonly endpoint: string;
  private readonly autoDetectEndpoint: string;

  constructor() {
    const customer = process.env.KUAIDI100_CUSTOMER || process.env.SHIPPING_KUAIDI100_CUSTOMER;
    const key = process.env.KUAIDI100_KEY || process.env.KUAIDI100_API_KEY || process.env.SHIPPING_API_KEY;
    if (!customer || !key) {
      throw new Error("快递100配置缺失，请设置 KUAIDI100_CUSTOMER 与 KUAIDI100_KEY。");
    }
    this.customer = customer;
    this.key = key;
    this.endpoint = process.env.KUAIDI100_ENDPOINT || "https://poll.kuaidi100.com/poll/query.do";
    this.autoDetectEndpoint = process.env.KUAIDI100_AUTODETECT_ENDPOINT || "https://www.kuaidi100.com/autonumber/autoComNum";
  }

  async createTracking(courier: string, trackingNo: string, options?: TrackingOptions) {
    return this.queryTracking(courier, trackingNo, options);
  }

  async refreshTracking(trackingNo: string, options?: TrackingOptions) {
    return this.queryTracking(options?.courier || "", trackingNo, options);
  }

  async handleWebhook() {
    return;
  }

  private async queryTracking(courier: string, trackingNo: string, options?: TrackingOptions) {
    const candidates: string[] = [];
    let firstError: Error | null = null;

    if (courier.trim()) {
      try {
        candidates.push(normalizeCourierCode(courier));
      } catch (error) {
        firstError = error instanceof Error ? error : new Error("快递公司识别失败。");
      }
    }

    const detectedCodes = await this.detectCourierCodes(trackingNo);
    for (const detectedCode of detectedCodes) {
      if (!candidates.includes(detectedCode)) candidates.push(detectedCode);
    }

    if (!candidates.length) {
      throw new Error("快递100未识别该单号对应的快递公司，请确认单号是真实物流单号，或补充顺丰/中通等快递所需的手机号后四位。");
    }

    for (let index = 0; index < candidates.length; index += 1) {
      const code = candidates[index];
      try {
        return await this.queryTrackingByCode(code, trackingNo, options);
      } catch (error) {
        const currentError = error instanceof Error ? error : new Error("快递100查询失败。");
        firstError ||= currentError;
        if (index === 0 && /找不到对应公司|快递公司|公司编码|com/.test(currentError.message)) {
          const detectedCodes = await this.detectCourierCodes(trackingNo);
          if (!detectedCodes.length) {
            firstError = new Error("快递100未识别该单号对应的快递公司，请确认单号是真实物流单号，或补充顺丰/中通等快递所需的手机号后四位。");
          }
          for (const detectedCode of detectedCodes) {
            if (!candidates.includes(detectedCode)) candidates.push(detectedCode);
          }
        }
      }
    }

    throw firstError || new Error("快递100暂无轨迹数据。");
  }

  private async queryTrackingByCode(courierCode: string, trackingNo: string, options?: TrackingOptions) {
    const param = JSON.stringify({
      com: courierCode,
      num: trackingNo,
      phone: options?.phone || undefined,
      resultv2: "1",
      show: "0",
    });
    const body = new URLSearchParams({
      customer: this.customer,
      sign: md5(param + this.key + this.customer),
      param,
    });

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`快递100接口请求失败：${response.status}`);
    }

    const data = (await response.json()) as Kuaidi100Response;
    if (!Array.isArray(data.data) || data.data.length === 0) {
      throw new Error(data.message || "快递100暂无轨迹数据。");
    }

    return data.data
      .map((event) => ({
        time: event.ftime || event.time || nowText(),
        description: event.context || event.status || event.areaName || "物流轨迹更新",
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  private async detectCourierCodes(trackingNo: string) {
    const url = new URL(this.autoDetectEndpoint);
    url.searchParams.set("text", trackingNo);
    url.searchParams.set("key", this.key);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return [];

    const data = (await response.json()) as Kuaidi100AutoDetectResponse;
    return (data.auto || []).map((item) => item.comCode).filter((code): code is string => Boolean(code));
  }
}

export class KdniaoProvider implements ShippingProvider {
  private readonly businessId: string;
  private readonly appKey: string;
  private readonly endpoint: string;

  constructor() {
    const businessId = process.env.KDNIAO_EBUSINESS_ID || process.env.KDNIAO_BUSINESS_ID;
    const appKey = process.env.KDNIAO_APP_KEY || process.env.KDNIAO_API_KEY;
    if (!businessId || !appKey) {
      throw new Error("快递鸟配置缺失，请设置 KDNIAO_EBUSINESS_ID 与 KDNIAO_APP_KEY。");
    }
    this.businessId = businessId;
    this.appKey = appKey;
    this.endpoint = process.env.KDNIAO_ENDPOINT || "https://api.kdniao.com/Ebusiness/EbusinessOrderHandle.aspx";
  }

  async createTracking(courier: string, trackingNo: string, options?: TrackingOptions) {
    return this.queryTracking(courier, trackingNo, options);
  }

  async refreshTracking(trackingNo: string, options?: TrackingOptions) {
    if (!options?.courier) {
      throw new Error("使用快递鸟刷新物流时需要快递公司。");
    }
    return this.queryTracking(options.courier, trackingNo, options);
  }

  async handleWebhook() {
    return;
  }

  private async queryTracking(courier: string, trackingNo: string, options?: TrackingOptions) {
    const requestData = JSON.stringify({
      OrderCode: "",
      ShipperCode: normalizeKdniaoCourierCode(courier),
      LogisticCode: trackingNo,
      CustomerName: options?.phone || undefined,
    });
    const body = new URLSearchParams({
      RequestType: "1002",
      EBusinessID: this.businessId,
      RequestData: requestData,
      DataSign: base64(md5(requestData + this.appKey)),
      DataType: "2",
    });

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded;charset=utf-8" },
      body,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`快递鸟接口请求失败：${response.status}`);
    }

    const data = (await response.json()) as KdniaoResponse;
    if (!data.Success) {
      throw new Error(data.Reason || "快递鸟查询失败，请确认接口服务已开通、快递公司和单号正确。");
    }
    if (!Array.isArray(data.Traces) || data.Traces.length === 0) {
      throw new Error(data.Reason || "快递鸟暂无轨迹数据。");
    }

    return data.Traces
      .map((event) => ({
        time: event.AcceptTime || nowText(),
        description: event.AcceptStation || event.Location || "物流轨迹更新",
      }))
      .sort((a, b) => a.time.localeCompare(b.time));
  }
}

export function getShippingProviderName(): ShippingProviderName {
  const requested = process.env.SHIPPING_PROVIDER?.toLowerCase();
  const hasKuaidi100Credentials = Boolean(
    (process.env.KUAIDI100_CUSTOMER || process.env.SHIPPING_KUAIDI100_CUSTOMER) &&
      (process.env.KUAIDI100_KEY || process.env.KUAIDI100_API_KEY || process.env.SHIPPING_API_KEY),
  );
  const hasKdniaoCredentials = Boolean(
    (process.env.KDNIAO_EBUSINESS_ID || process.env.KDNIAO_BUSINESS_ID) &&
      (process.env.KDNIAO_APP_KEY || process.env.KDNIAO_API_KEY),
  );
  if (requested === "kdniao" && hasKdniaoCredentials) return "kdniao";
  if (requested === "kuaidi100" && hasKuaidi100Credentials) return "kuaidi100";
  return "mock";
}

export function getShippingProvider(): ShippingProvider {
  const provider = getShippingProviderName();
  if (provider === "kuaidi100") return new Kuaidi100Provider();
  if (provider === "kdniao") return new KdniaoProvider();
  return new MockShippingProvider();
}

export function getShippingModeInfo(provider = getShippingProviderName()): ShippingModeInfo {
  return provider === "kuaidi100" || provider === "kdniao"
    ? {
        provider,
        mode: "realtime",
        canAutoTrack: true,
        requiresManualConfirm: true,
        message: `已启用${provider === "kdniao" ? "快递鸟" : "快递100"}真实查询；签收仍需人工确认后更新状态。`,
      }
    : {
        provider,
        mode: "manual",
        canAutoTrack: false,
        requiresManualConfirm: true,
        message: "当前为本地手工物流模式，不自动查询真实轨迹。",
      };
}
