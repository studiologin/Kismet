"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { checkPin, createSession, destroySession, getSession, isPinConfigured } from "@/lib/auth";
import { MONTHS, nowInSaoPaulo } from "@/lib/dates";
import { isSheetsConfigured } from "@/lib/google-sheets";
import {
  CATEGORIES,
  MATCHES_PER_MONTH,
  PLAYER_NAME,
  validateScore,
  type PlayerId,
  type Scores,
} from "@/lib/kismet";
import { clearLive, getLiveState, saveLivePlay, startLive, undoLivePlay, type LiveState } from "@/lib/live";
import { buildMatch, matchId, nextSlot } from "@/lib/match";
import { MATCHES_TAG, MatchConflictError, getMatchesFresh, importLegacy, saveMatch } from "@/lib/matches";

const isPlayer = (v: unknown): v is PlayerId => v === "manoel" || v === "ana";

function refreshPages() {
  updateTag(MATCHES_TAG);
  revalidatePath("/");
  revalidatePath("/registrar");
}

/* ───────────── login por perfil ───────────── */

export interface LoginState {
  error?: string;
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!isPinConfigured()) return { error: "PINs não configurados no servidor (MANOEL_PIN / ANA_PIN)." };
  const player = formData.get("player");
  if (!isPlayer(player)) return { error: "Escolha quem está entrando." };
  const pin = String(formData.get("pin") ?? "");
  if (!checkPin(player, pin)) {
    await new Promise((r) => setTimeout(r, 600)); // freio simples contra tentativa e erro
    return { error: "PIN incorreto." };
  }
  await createSession(player);
  redirect("/registrar");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/* ───────────── validação comum ───────────── */

function validateHeader(i: { date: string; year: number; month: number; number: number }): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i.date)) return "Data inválida.";
  if (!Number.isInteger(i.year) || i.year < 2000 || i.year > 2100) return "Ano inválido.";
  if (!Number.isInteger(i.month) || i.month < 1 || i.month > 12) return "Mês inválido.";
  if (!Number.isInteger(i.number) || i.number < 1 || i.number > MATCHES_PER_MONTH) {
    return `Nº da partida deve ser de 1 a ${MATCHES_PER_MONTH}.`;
  }
  return null;
}

function validateCard(player: PlayerId, raw: Partial<Record<string, number | null>> | undefined) {
  const errors: string[] = [];
  const s = {} as Scores;
  for (const cat of CATEGORIES) {
    const v = raw?.[cat.id];
    const value = v === null || v === undefined ? null : Number(v);
    const err = validateScore(cat, value);
    if (err) errors.push(`${PLAYER_NAME[player]} · ${cat.label}: ${err}`);
    s[cat.id] = value ?? 0;
  }
  return { scores: s, errors };
}

/* ───────────── partida ao vivo ───────────── */

export type LiveResult = { ok: true; state: LiveState | null } | { ok: false; error: string; conflict?: boolean };

/**
 * Inicia a PRÓXIMA partida do mês corrente — o jogador não escolhe data nem número:
 * data = hoje (São Paulo), mês = mês atual, número = primeira partida livre do mês.
 */
export async function startLiveAction(input: { firstPlayer: PlayerId }): Promise<LiveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };

  try {
    const now = nowInSaoPaulo();
    const next = nextSlot(await getMatchesFresh(), now.year, now.month);
    if (next === null) {
      return {
        ok: false,
        error: `As ${MATCHES_PER_MONTH} partidas de ${MONTHS[now.month - 1]} já foram jogadas. A próxima fica para o mês que vem.`,
      };
    }
    const state = await startLive({
      key: matchId(now.year, now.month, next),
      date: now.iso,
      year: now.year,
      month: now.month,
      number: next,
      overwrite: false,
      startedBy: session.player,
      firstPlayer: isPlayer(input?.firstPlayer) ? input.firstPlayer : session.player,
    });
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível iniciar a partida." };
  }
}

/** Salva UMA jogada do jogador logado (uma categoria) e passa a vez. */
export async function playAction(cat: string, value: number): Promise<LiveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!CATEGORIES.some((c) => c.id === cat)) return { ok: false, error: "Categoria inválida." };
  try {
    const state = await saveLivePlay(session.player, cat as (typeof CATEGORIES)[number]["id"], Number(value));
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha ao salvar a jogada." };
  }
}

/** Desfaz a última jogada do jogador logado (se o outro ainda não jogou depois). */
export async function undoPlayAction(): Promise<LiveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  try {
    const state = await undoLivePlay(session.player);
    return { ok: true, state };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível desfazer." };
  }
}

export type FinalizeResult =
  | { ok: true; summary: { id: string; manoel: number; ana: number; winner: string } }
  | { ok: false; error: string; fieldErrors?: string[] };

export async function finalizeLiveAction(): Promise<FinalizeResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  if (!isSheetsConfigured()) return { ok: false, error: "Google Sheets não configurado." };

  const live = await getLiveState(true);
  if (!live) return { ok: false, error: "Nenhuma partida em andamento." };

  const m = validateCard("manoel", live.entries.manoel?.scores);
  const a = validateCard("ana", live.entries.ana?.scores);
  const fieldErrors = [...m.errors, ...a.errors];
  if (fieldErrors.length) {
    return { ok: false, error: "As duas cartelas precisam estar completas e válidas.", fieldErrors };
  }

  const match = buildMatch({
    date: live.date,
    year: live.year,
    month: live.month,
    number: live.number,
    scores: { manoel: m.scores, ana: a.scores },
    registeredAt: `${nowInSaoPaulo().stamp} · ao vivo`,
  });

  try {
    await saveMatch(match, live.overwrite);
    await clearLive();
    refreshPages();
    return {
      ok: true,
      summary: {
        id: match.id,
        manoel: match.totals.manoel.total,
        ana: match.totals.ana.total,
        winner: match.winner === "empate" ? "Empate" : PLAYER_NAME[match.winner],
      },
    };
  } catch (e) {
    if (e instanceof MatchConflictError) return { ok: false, error: e.message };
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao gravar na planilha." };
  }
}

export async function cancelLiveAction(): Promise<LiveResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sessão expirada. Entre novamente." };
  await clearLive();
  return { ok: true, state: null };
}

/* ───────────── lançamento manual (as duas colunas) ───────────── */

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
  if (!(await getSession())) return { ok: false, error: "Sessão expirada. Entre com o PIN novamente." };
  if (!isSheetsConfigured()) {
    return { ok: false, error: "Google Sheets não configurado. Defina as variáveis de ambiente (veja o guia)." };
  }
  const headerError = validateHeader(input);
  if (headerError) return { ok: false, error: headerError };

  const m = validateCard("manoel", input.scores?.manoel);
  const a = validateCard("ana", input.scores?.ana);
  const fieldErrors = [...m.errors, ...a.errors];
  if (fieldErrors.length) return { ok: false, error: "Corrija os campos destacados.", fieldErrors };

  const match = buildMatch({
    date: input.date,
    year: input.year,
    month: input.month,
    number: input.number,
    scores: { manoel: m.scores, ana: a.scores },
    registeredAt: nowInSaoPaulo().stamp,
  });

  try {
    const status = await saveMatch(match, Boolean(input.overwrite));
    refreshPages();
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
  if (!(await getSession())) return { ok: false, error: "Sessão expirada." };
  if (!isSheetsConfigured()) return { ok: false, error: "Google Sheets não configurado." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Ano inválido." };
  try {
    const r = await importLegacy(year);
    refreshPages();
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Falha na importação." };
  }
}
