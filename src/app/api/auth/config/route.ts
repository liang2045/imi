import { NextResponse } from "next/server";
import { getRequiredEnvForDiagnostics, isDingtalkConfigured } from "@/lib/auth/dingtalk";

export async function GET() {
  return NextResponse.json({
    dingtalkEnabled: isDingtalkConfigured(),
    requiredEnv: getRequiredEnvForDiagnostics(),
  });
}
