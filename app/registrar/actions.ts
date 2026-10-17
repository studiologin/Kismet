"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { checkPin, createSession, destroySession, isAuthenticated, isPinConfigured } from "@/lib/auth";
import { nowInSaoPaulo } from "@/lib/dates";
import { isSheetsConfigured } from "@/lib/google-sheets";
import { CATEGORIES, MATCHES_PER_MONTH, PLAYER_NAME, validateScore, type PlayerId, type Scores } from "@/lib/kismet";
import { buildMatch } from "@/lib/match";
import { MATCHES_TAG, MatchConflictError, importLegacy, saveMatch } from "@/lib/matches";

/* ───────────── login ───────────── */

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isPinConfigured()) return { error: "ADMIN_PIN não configurado no servidor." };
  const pin = String(formData.get("pin") ?? "");
  if (!checkPin(pin)) {
    await new Promise((r) => setTimeout(r, 600)); // freio simples contra tentativa e erro
    return { error: "PIN incorreto." };
  }
  await createSession();
  redirect("/registrar");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/* ───────────── salvar partida ───────────── */

export interface SaveInput {
  date: string;
  year: number;
  month: number;
  number: number;
  overwrite: boolean;
  scores: Record<PlayerId, Partial<Record<string, number | null>>>;
}

export type SaveResult =
  | {
      ok: true;
      status: "created" | "updated";
      summary: { id: string; manoel: number; ana: number; winner: string };
    }
  | { ok: false; error: string; conflict?: boolean; fieldErrors?: string[] };

export async function saveMatchAction(input: SaveInput): Promise<SaveResult> {
  if (!(await isAuthenticated())) return { ok: false, error: "Sessão expirada. Entre com o PIN novamente." };
  if (!isSheetsConfigured()) {
    return { ok: false, error: "Google Sheets não configurado. Defina as variáveis de ambiente (veja o guia)." };
  }

  // validação de cabeçalho
  const { date, year, month, number } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Data inválida." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Ano inválido." };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok: false, error: "Mês inválido." };
  if (!Number.isInteger(number) || number < 1 || number > MATCHES_PER_MONTH) {
    return { ok: false, error: `Nº da partida deve ser de 1 a ${MATCHES_PER_MONTH}.` };
  }

  // validação da cartela
  const fieldErrors: string[] = [];
  const clean = {} as Record<PlayerId, Scores>;
  for (const player of ["manoel", "ana"] as PlayerId[]) {
    const s = {} as Scores;
    for (const cat of CATEGORIES) {
      const raw = input.scores?.[player]?.[cat.id];
      const value = raw === null || raw === undefined ? null : Number(raw);
      const err = validateScore(cat, value);
      if (err) fieldErrors.push(`${PLAYER_NAME[player]} · ${cat.label}: ${err}`);
      s[cat.id] = value ?? 0;
    }
    clean[player] = s;
  }
  if (fieldErrors.length) return { ok: false, error: "Corrija os campos destacados.", fieldErrors };

  const match = buildMatch({
    date,
    year,
    month,
    number,
    scores: clean,
    registeredAt: nowInSaoPaulo().stamp,
  });

  try {
    const status = await saveMatch(match, Boolean(input.overwrite));
    updateTag(MATCHES_TAG);
    revalidatePath("/");
    revalidatePath("/registrar");
    return {
      ok: true,
      status,
      summary: {
        id: match.id,
        manoel: match.totals.manoel.total,
        ana: match.totals.ana.total,
        winner: match.winner === "empate" ? "Empate" : PLAYER_NAME[match.winner],
      },
    };
  } catch (e) {
    if (e instanceof MatchConflictError) return { ok: false, error: e.message, conflict: true };
    console.error("[kismet] erro ao salvar:", e);
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido ao gravar na planilha." };
  }
}

/* ───────────── importar histórico ───────────── */

export type ImportResult = { ok: true; imported: number; skipped: number } | { ok: false; error: string };

export async function importLegacyAction(year: number): Promise<ImportResult> {
  if (!(await isAuthenticated())) return { ok: false, error: "Sessão expirada." };
  if (!isSheetsConfigured()) return { ok: false, error: "Google Sheets não configurado." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Ano inválido." };
  try {
    const r = await importLegacy(year);
    updateTag(MATCHES_TAG);
    revalidatePath("/");
    revalidatePath("/registrar");
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha na importação." };
  }
}
