import { NextResponse } from "next/server";
import { getCurrentUserFromCookie, isDingtalkConfigured } from "@/lib/auth/dingtalk";

export async function GET() {
  return NextResponse.json({
    dingtalkEnabled: isDingtalkConfigured(),
    user: await getCurrentUserFromCookie(),
  });
}
