import { NextRequest } from "next/server";
import { initialState } from "@/lib/mock-data";
import { getAnalytics, groupCount } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month") || "2026-06";
  const items = initialState.collaborations.filter((item) => item.month === month);
  const monthFinance = initialState.monthlyFinance?.[month];
  return Response.json({ month, metrics: getAnalytics(items, monthFinance?.budgetCents ?? initialState.budgetCents, { averageCents: monthFinance?.averageCents }), statusDistribution: groupCount(items, "status") });
}
