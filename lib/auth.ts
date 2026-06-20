import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { requireEnv } from "./config";
import { getSupabaseAdmin } from "./supabase";

const COOKIE_NAME = "shuangmulin_chat_session";
const PASSWORD_KEY_LENGTH = 64;

export type SessionUser = {
  id: string;
  email: string;
};

function sign(value: string) {
  return createHmac("sha256", requireEnv("AUTH_SECRET")).update(value).digest("base64url");
}

function sessionValue(user: SessionUser) {
  const payload = Buffer.from(JSON.stringify({ user, iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verifySession(value?: string): SessionUser | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { user?: SessionUser };
    if (!decoded.user?.id || !decoded.user.email) return null;
    return decoded.user;
  } catch {
    return null;
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, passwordHash: string) {
  const [salt, storedHash] = passwordHash.split(":");
  if (!salt || !storedHash) return false;
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const stored = Buffer.from(storedHash, "hex");
  return stored.length === hash.length && timingSafeEqual(stored, hash);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  return verifySession(cookieStore.get(COOKIE_NAME)?.value);
}

export async function isAuthenticated() {
  return Boolean(await getCurrentUser());
}

export async function requireAuth() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function setSessionCookie(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionValue(user), {
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

export async function createUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || password.length < 8) {
    throw new Error("邮箱不能为空，密码至少 8 位。");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .insert({ email: normalizedEmail, password_hash: hashPassword(password) })
    .select("id,email")
    .single();
  if (error) throw error;
  return data as SessionUser;
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id,email,password_hash")
    .eq("email", normalizedEmail)
    .single();
  if (error || !data || !verifyPassword(password, data.password_hash)) {
    throw new Error("邮箱或密码不正确。");
  }
  return { id: data.id, email: data.email } as SessionUser;
}
