import crypto from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export type AppRole = "admin" | "member";
export type UserStatus = "active" | "pending" | "disabled";

export interface SessionUser {
  id: string;
  dingtalkUnionId: string;
  dingtalkUserId?: string;
  name: string;
  avatarUrl?: string;
  mobile?: string;
  role: AppRole;
  status: UserStatus;
}

export interface DingtalkRuntimeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  sessionSecret: string;
  appOrigin: string;
  adminUnionIds: string[];
}

const SESSION_COOKIE = "creator_ops_session";
const OAUTH_STATE_COOKIE = "creator_ops_dingtalk_state";
const TOKEN_URL = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
const USER_INFO_URL = "https://api.dingtalk.com/v1.0/contact/users/me";
const AUTH_URL = "https://login.dingtalk.com/oauth2/auth";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export function getDingtalkConfig(): DingtalkRuntimeConfig | null {
  const clientId = process.env.DINGTALK_CLIENT_ID?.trim();
  const clientSecret = process.env.DINGTALK_CLIENT_SECRET?.trim();
  const redirectUri = process.env.DINGTALK_REDIRECT_URI?.trim();
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (!clientId || !clientSecret || !redirectUri || !sessionSecret) return null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    sessionSecret,
    appOrigin: process.env.LOCAL_APP_ORIGIN?.trim() || "http://localhost:3000",
    adminUnionIds: (process.env.ADMIN_DINGTALK_UNION_IDS || "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  };
}

export function isDingtalkConfigured() {
  return Boolean(getDingtalkConfig());
}

export function buildDingtalkAuthUrl(config: DingtalkRuntimeConfig, state: string) {
  const url = new URL(AUTH_URL);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function encodeSession(user: SessionUser, secret: string) {
  const payload = base64url(JSON.stringify({ user, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${payload}.${sign(payload, secret)}`;
}

export function decodeSession(token: string | undefined, secret: string): SessionUser | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user: SessionUser; exp: number };
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

export async function getCurrentUserFromCookie() {
  const config = getDingtalkConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return decodeSession(cookieStore.get(SESSION_COOKIE)?.value, config.sessionSecret);
}

export function setSessionCookie(response: NextResponse, user: SessionUser, config: DingtalkRuntimeConfig) {
  response.cookies.set(SESSION_COOKIE, encodeSession(user, config.sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: config.redirectUri.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export function setOauthStateCookie(response: NextResponse, state: string, secure: boolean) {
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 60 * 10,
  });
}

export function consumeOauthState(requestState: string | null, cookieState: string | undefined) {
  return Boolean(requestState && cookieState && requestState === cookieState);
}

export function clearOauthStateCookie(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getDingtalkUser(code: string, config: DingtalkRuntimeConfig) {
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      grantType: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error(`DingTalk token failed: ${tokenResponse.status}`);
  const tokenBody = (await tokenResponse.json()) as { accessToken?: string };
  if (!tokenBody.accessToken) throw new Error("DingTalk token response has no accessToken");

  const userResponse = await fetch(USER_INFO_URL, {
    headers: { "x-acs-dingtalk-access-token": tokenBody.accessToken },
  });
  if (!userResponse.ok) throw new Error(`DingTalk user info failed: ${userResponse.status}`);
  return (await userResponse.json()) as {
    unionId?: string;
    unionid?: string;
    userId?: string;
    userid?: string;
    nick?: string;
    name?: string;
    avatarUrl?: string;
    avatar?: string;
    mobile?: string;
  };
}

export async function upsertDingtalkUser(userInfo: Awaited<ReturnType<typeof getDingtalkUser>>, config: DingtalkRuntimeConfig): Promise<SessionUser> {
  const unionId = userInfo.unionId || userInfo.unionid;
  if (!unionId) throw new Error("DingTalk user info has no unionId");
  const userId = userInfo.userId || userInfo.userid;
  const name = userInfo.nick || userInfo.name || "钉钉用户";
  const avatarUrl = userInfo.avatarUrl || userInfo.avatar;
  const mobile = userInfo.mobile;
  const role: AppRole = config.adminUnionIds.includes(unionId) ? "admin" : "member";
  const status: UserStatus = config.adminUnionIds.length === 0 || config.adminUnionIds.includes(unionId) ? "active" : "pending";

  const sessionUser: SessionUser = {
    id: unionId,
    dingtalkUnionId: unionId,
    dingtalkUserId: userId,
    name,
    avatarUrl,
    mobile,
    role,
    status,
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const { data: existing } = await supabase
      .from("users")
      .select("role,status")
      .eq("dingtalk_union_id", unionId)
      .maybeSingle();
    const { error } = await supabase.from("users").upsert(
      {
        dingtalk_union_id: unionId,
        dingtalk_user_id: userId,
        name,
        avatar_url: avatarUrl,
        mobile,
        role: existing?.role || role,
        status: existing?.status || status,
        last_login_at: new Date().toISOString(),
      },
      { onConflict: "dingtalk_union_id" },
    );
    if (error) throw error;
    sessionUser.role = (existing?.role as AppRole | undefined) || role;
    sessionUser.status = (existing?.status as UserStatus | undefined) || status;
  }

  return sessionUser;
}

export function getRequiredEnvForDiagnostics() {
  return ["DINGTALK_CLIENT_ID", "DINGTALK_CLIENT_SECRET", "DINGTALK_REDIRECT_URI", "SESSION_SECRET"].map((name) => ({
    name,
    configured: Boolean(process.env[name]?.trim()),
  }));
}

export function assertDingtalkConfig() {
  required("DINGTALK_CLIENT_ID");
  required("DINGTALK_CLIENT_SECRET");
  required("DINGTALK_REDIRECT_URI");
  required("SESSION_SECRET");
  return getDingtalkConfig()!;
}
