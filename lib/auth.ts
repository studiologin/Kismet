import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "kismet_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PIN;
  if (!s) return null;
  return `kismet::${s}`;
}

function sign(value: string) {
  const s = secret();
  if (!s) return null;
  return createHmac("sha256", s).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function isPinConfigured() {
  return Boolean(process.env.ADMIN_PIN?.trim());
}

export function checkPin(pin: string) {
  const expected = process.env.ADMIN_PIN?.trim();
  if (!expected) return false;
  return safeEqual(pin.trim(), expected);
}

export async function createSession() {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const sig = sign(exp);
  if (!sig) return;
  const jar = await cookies();
  jar.set(COOKIE, `${exp}.${sig}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthenticated() {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig) return false;
  const expected = sign(exp);
  if (!expected || !safeEqual(sig, expected)) return false;
  return Number(exp) > Date.now() / 1000;
}
