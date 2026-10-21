import {
  CATEGORIES,
  MATCHES_PER_MONTH,
  LOWER,
  PLAYERS,
  PLAYER_NAME,
  UPPER,
  computeTotals,
  decideWinner,
  type PlayerId,
  type PlayerTotals,
  type Scores,
  type Winner,
} from "./kismet";

export interface Match {
  id: string;
  /** ISO (YYYY-MM-DD) ou "" quando a data exata é desconhecida (histórico importado) */
  date: string;
  year: number;
  month: number; // 1–12
  number: number; // 1–3
  scores: Record<PlayerId, Scores>;
  totals: Record<PlayerId, PlayerTotals>;
  winner: Winner;
  registeredAt: string;
  /** linha na planilha (1-based), presente quando lido do Sheets */
  row?: number;
}

export function matchId(year: number, month: number, number: number) {
  return `${year}-${String(month).padStart(2, "0")}-P${number}`;
}

export function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function buildMatch(input: {
  date: string;
  year: number;
  month: number;
  number: number;
  scores: Record<PlayerId, Scores>;
  registeredAt?: string;
}): Match {
  const totals = {
    manoel: computeTotals(input.scores.manoel),
    ana: computeTotals(input.scores.ana),
  };
  return {
    id: matchId(input.year, input.month, input.number),
    date: input.date,
    year: input.year,
    month: input.month,
    number: input.number,
    scores: input.scores,
    totals,
    winner: decideWinner(totals.manoel.total, totals.ana.total),
    registeredAt: input.registeredAt ?? "",
  };
}

/* ───────────── layout da planilha (uma linha por partida) ───────────── */

function playerHeader(name: string): string[] {
  return [
    ...UPPER.map((c) => `${name} - ${c.label}`),
    `${name} - Subtotal Superior`,
    `${name} - Bônus`,
    `${name} - Total Superior`,
    ...LOWER.map((c) => `${name} - ${c.label}`),
    `${name} - Total Inferior`,
    `${name} - Total`,
  ];
}

export const SHEET_HEADER: string[] = [
  "ID",
  "Data",
  "Mês/Ano",
  "Nº Partida",
  ...PLAYERS.flatMap((p) => playerHeader(p.name)),
  "Vencedor",
  "Registrado em",
];

const PLAYER_BLOCK = UPPER.length + 3 + LOWER.length + 2;

function isoToBr(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function brToIso(br: string) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(br.trim());
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

export function matchToRow(m: Match): (string | number)[] {
  const block = (p: PlayerId) => {
    const s = m.scores[p];
    const t = m.totals[p];
    return [
      ...UPPER.map((c) => s[c.id]),
      t.upperSubtotal,
      t.bonus,
      t.upperTotal,
      ...LOWER.map((c) => s[c.id]),
      t.lowerTotal,
      t.total,
    ];
  };
  return [
    m.id,
    isoToBr(m.date),
    `${String(m.month).padStart(2, "0")}/${m.year}`,
    m.number,
    ...block("manoel"),
    ...block("ana"),
    m.winner === "empate" ? "Empate" : PLAYER_NAME[m.winner],
    m.registeredAt,
  ];
}

function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Converte data vinda do Sheets (string BR, ISO ou número serial) para ISO */
function cellToIso(v: unknown): string {
  if (typeof v === "number" && v > 20000) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    return brToIso(v);
  }
  return "";
}

export function rowToMatch(row: unknown[], rowNumber: number): Match | null {
  if (!row || row.length < 4 || !row[0]) return null;
  const ref = String(row[2] ?? "");
  const mm = /^(\d{1,2})\/(\d{4})$/.exec(ref.trim());
  if (!mm) return null;
  const month = Number(mm[1]);
  const year = Number(mm[2]);
  const number = num(row[3]);
  const scoresFor = (offset: number): Scores => {
    const s = {} as Scores;
    UPPER.forEach((c, i) => (s[c.id] = num(row[offset + i])));
    const lowerStart = offset + UPPER.length + 3;
    LOWER.forEach((c, i) => (s[c.id] = num(row[lowerStart + i])));
    return s;
  };
  const base = 4;
  const match = buildMatch({
    date: cellToIso(row[1]),
    year,
    month,
    number,
    scores: { manoel: scoresFor(base), ana: scoresFor(base + PLAYER_BLOCK) },
    registeredAt: String(row[base + PLAYER_BLOCK * 2 + 1] ?? ""),
  });
  match.id = String(row[0]);
  match.row = rowNumber;
  return match;
}

export function sortMatches(list: Match[]): Match[] {
  return [...list].sort(
    (a, b) => a.year - b.year || a.month - b.month || a.number - b.number || a.date.localeCompare(b.date),
  );
}

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/** Nº da rodada no ano (1–36): janeiro = 1–3, fevereiro = 4–6 … dezembro = 34–36. */
export function roundOf(m: Pick<Match, "month" | "number">): number {
  return (m.month - 1) * MATCHES_PER_MONTH + m.number;
}

export function slotOfRound(round: number) {
  return { month: Math.ceil(round / MATCHES_PER_MONTH), number: ((round - 1) % MATCHES_PER_MONTH) + 1 };
}

export const ROUNDS_PER_YEAR = 12 * MATCHES_PER_MONTH;

/**
 * Próxima rodada na sequência da planilha: a rodada seguinte à última jogada
 * da temporada (ano mais recente com partidas). Ex.: última = 24 (3ª de agosto)
 * → próxima = 25 (1ª de setembro), mesmo que o jogo aconteça em outubro.
 * Depois da 36ª, a sequência continua na rodada 1 do ano seguinte.
 */
export function nextRound(list: Pick<Match, "year" | "month" | "number">[], fallbackYear: number) {
  const year = list.length ? Math.max(...list.map((m) => m.year)) : fallbackYear;
  const last = Math.max(0, ...list.filter((m) => m.year === year).map(roundOf));
  if (last >= ROUNDS_PER_YEAR) return { year: year + 1, round: 1, ...slotOfRound(1) };
  const round = last + 1;
  return { year, round, ...slotOfRound(round) };
}
