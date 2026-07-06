import { z } from "zod";
import { getShippingModeInfo, getShippingProvider, getShippingProviderName } from "@/lib/shipping";

export const runtime = "nodejs";

const input = z.object({
  action: z.enum(["create", "refresh"]).default("create"),
  courier: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  trackingNo: z.string().trim().min(5, "快递单号至少 5 位"),
});

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "物流信息不完整", details: parsed.error.flatten() }, { status: 400 });
  }

  const provider = getShippingProvider();
  const providerName = getShippingProviderName();
  const modeInfo = getShippingModeInfo(providerName);

  try {
    if (parsed.data.action === "refresh") {
      const events = await provider.refreshTracking(parsed.data.trackingNo, {
        courier: parsed.data.courier,
        phone: parsed.data.phone,
      });
      return Response.json({ ...modeInfo, events });
    }

    if (!parsed.data.courier) {
      return Response.json({ error: "请选择快递公司" }, { status: 400 });
    }

    const events = await provider.createTracking(parsed.data.courier, parsed.data.trackingNo, {
      phone: parsed.data.phone,
    });
    return Response.json({ ...modeInfo, events });
  } catch (error) {
    return Response.json(
      {
        error: "物流供应商查询失败",
        ...modeInfo,
        providerMessage: error instanceof Error ? error.message : "未知错误",
      },
      { status: 502 },
    );
  }
}
