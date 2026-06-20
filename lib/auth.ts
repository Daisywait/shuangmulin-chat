import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { requireEnv } from "./config";

const COOKIE_NAME = "gateway_chat_session";

function sign(value: string) {
  return createHmac("sha256", requireEnv("AUTH_SECRET")).update(value).digest("base64url");
}

function sessionValue(email: string) {
  const payload = Buffer.from(JSON.stringify({ email, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySession(value?: string) {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { email?: string };
    return decoded.email === requireEnv("ADMIN_EMAIL");
  } catch {
    return false;
  }
}

export async function isAuthenticated() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireAuth() {
  if (!(await isAuthenticated())) {
    throw new Error("Unauthorized");
  }
}

export async function setSessionCookie(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionValue(email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function validateLogin(email: string, password: string) {
  return email === requireEnv("ADMIN_EMAIL") && password === requireEnv("ADMIN_PASSWORD");
}
