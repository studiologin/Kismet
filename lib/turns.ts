import { CATEGORIES, type CategoryId, type PlayerId } from "./kismet";

/** Uma jogada: o jogador marcou uma categoria com um valor (0 = riscou). */
export interface Play {
  cat: CategoryId;
  value: number;
  at: string; // ISO — define a ordem das jogadas
}

export type LiveScores = Partial<Record<CategoryId, number>>;

export interface LiveMeta {
  key: string; // 2026-10-P1
  date: string; // ISO
  year: number;
  month: number;
  number: number;
  overwrite: boolean;
  startedBy: PlayerId;
  firstPlayer?: PlayerId; // quem joga a primeira rodada
}

export interface LiveEntry {
  plays: Play[];
  scores: LiveScores;
  updatedAt: string;
}

export interface LiveState extends LiveMeta {
  firstPlayer: PlayerId;
  entries: Partial<Record<PlayerId, LiveEntry>>;
  /** de quem é a vez agora (null quando as duas cartelas estão completas) */
  turn: PlayerId | null;
}

export const TOTAL_ROUNDS = CATEGORIES.length; // 15

export const otherPlayer = (p: PlayerId): PlayerId => (p === "manoel" ? "ana" : "manoel");

export function scoresFromPlays(plays: Play[]): LiveScores {
  const s: LiveScores = {};
  for (const p of plays) s[p.cat] = p.value;
  return s;
}

/**
 * A vez alterna: quem começa joga a rodada 1, o outro joga a rodada 1, e assim por diante.
 * Se os dois têm o mesmo número de jogadas → vez de quem começa; senão → vez do outro.
 */
export function nextTurn(s: Pick<LiveState, "firstPlayer" | "entries">): PlayerId | null {
  const first = s.firstPlayer;
  const second = otherPlayer(first);
  const a = s.entries[first]?.plays.length ?? 0;
  const b = s.entries[second]?.plays.length ?? 0;
  if (a >= TOTAL_ROUNDS && b >= TOTAL_ROUNDS) return null;
  if (a > b) return second;
  if (a >= TOTAL_ROUNDS) return second;
  return first;
}

/** Linha do tempo das jogadas dos dois, na ordem em que aconteceram. */
export function timeline(s: Pick<LiveState, "entries">) {
  const all: (Play & { player: PlayerId; round: number })[] = [];
  for (const player of ["manoel", "ana"] as PlayerId[]) {
    (s.entries[player]?.plays ?? []).forEach((p, i) => all.push({ ...p, player, round: i + 1 }));
  }
  return all.sort((x, y) => x.at.localeCompare(y.at));
}
