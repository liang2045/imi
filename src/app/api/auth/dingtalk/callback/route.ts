import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  clearOauthStateCookie,
  consumeOauthState,
  getDingtalkConfig,
  getDingtalkUser,
  setSessionCookie,
  upsertDingtalkUser,
} from "@/lib/auth/dingtalk";

function redirectWithError(appOrigin: string, code: string) {
  return NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(code)}`, appOrigin));
}

export async function GET(request: NextRequest) {
  const config = getDingtalkConfig();
  if (!config) return redirectWithError("http://localhost:3000", "dingtalk_not_configured");

  const code = request.nextUrl.searchParams.get("authCode") || request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("creator_ops_dingtalk_state")?.value;

  if (!consumeOauthState(state, cookieState)) {
    const response = redirectWithError(config.appOrigin, "invalid_oauth_state");
    clearOauthStateCookie(response);
    return response;
  }
  if (!code) {
    const response = redirectWithError(config.appOrigin, "missing_oauth_code");
    clearOauthStateCookie(response);
    return response;
  }

  try {
    const userInfo = await getDingtalkUser(code, config);
    const user = await upsertDingtalkUser(userInfo, config);
    const response = user.status === "active"
      ? NextResponse.redirect(new URL("/", config.appOrigin))
      : redirectWithError(config.appOrigin, "account_pending");
    if (user.status === "active") setSessionCookie(response, user, config);
    clearOauthStateCookie(response);
    return response;
  } catch (error) {
    console.error(error);
    const response = redirectWithError(config.appOrigin, "dingtalk_callback_failed");
    clearOauthStateCookie(response);
    return response;
  }
}
