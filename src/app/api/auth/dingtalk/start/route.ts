import crypto from "crypto";
import { NextResponse } from "next/server";
import { buildDingtalkAuthUrl, getDingtalkConfig, setOauthStateCookie } from "@/lib/auth/dingtalk";

export async function GET() {
  const config = getDingtalkConfig();
  if (!config) {
    return NextResponse.redirect(new URL("/?auth_error=dingtalk_not_configured", "http://localhost:3000"));
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(buildDingtalkAuthUrl(config, state));
  setOauthStateCookie(response, state, config.redirectUri.startsWith("https://"));
  return response;
}
