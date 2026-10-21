import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { PlayerId } from "./kismet";

/**
 * Perfis de acesso: Manoel e Ana, cada um com o seu PIN.
 *   MANOEL_PIN / ANA_PIN  → PIN de cada jogador
 *   ADMIN_PIN (legado)    → aceito para qualquer um dos dois perfis
 * A sessão é um cookie httpOnly assinado com HMAC: "<jogador>.<expira>.<assinatura>".
 */

const COOKIE = "kismet_session";
const MAX_AGE = 60 * 60 * 24 * 90; // 90 dias — o app fica logado no celular

export interface Session {
  player: PlayerId;
}

function secret() {
  const s = process.env.SESSION_SECRET || process.env.ADMIN_PIN || process.env.MANOEL_PIN;
  return s ? `kismet::${s}` : null;
}

function sign(value: string) {
  const s = secret();
  return s ? createHmac("sha256", s).update(value).digest("base64url") : null;
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

const isPlayer = (v: string): v is PlayerId => v === "manoel" || v === "ana";

function pinsFor(player: PlayerId): string[] {
  const own = (player === "manoel" ? process.env.MANOEL_PIN : process.env.ANA_PIN)?.trim();
  const admin = process.env.ADMIN_PIN?.trim();
  return [own, admin].filter((p): p is string => Boolean(p));
}

export function isPinConfigured() {
  return pinsFor("manoel").length > 0 && pinsFor("ana").length > 0;
}

export function checkPin(player: PlayerId, pin: string) {
  const typed = pin.trim();
  return typed.length > 0 && pinsFor(player).some((p) => safeEqual(typed, p));
}

export async function createSession(player: PlayerId) {
  const exp = String(Math.floor(Date.now() / 1000) + MAX_AGE);
  const payload = `${player}.${exp}`;
  const sig = sign(payload);
  if (!sig) return;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}.${sig}`, {
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

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const [player, exp, sig] = raw.split(".");
  if (!player || !exp || !sig || !isPlayer(player)) return null;
  const expected = sign(`${player}.${exp}`);
  if (!expected || !safeEqual(sig, expected)) return null;
  if (Number(exp) <= Date.now() / 1000) return null;
  return { player };
}

export async function isAuthenticated() {
  return (await getSession()) !== null;
}
