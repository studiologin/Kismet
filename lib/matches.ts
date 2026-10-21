import "server-only";
import { unstable_cache } from "next/cache";
import { DEMO_MATCHES } from "./demo-data";
import {
  addTab,
  appendValues,
  getValues,
  isSheetsConfigured,
  listTabs,
  sheetsConfig,
  tabRef,
  updateValues,
} from "./google-sheets";
import { MATCHES_PER_MONTH } from "./kismet";
import { parseLegacyGrid } from "./legacy";
import { SHEET_HEADER, matchToRow, rowToMatch, sortMatches, type Match } from "./match";

export const MATCHES_TAG = "matches";
const LAST_COL = columnLetter(SHEET_HEADER.length);

function columnLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export type DataSource = "sheets" | "demo" | "error";

export interface MatchesResult {
  matches: Match[];
  source: DataSource;
  error?: string;
}

/** Garante que a aba exista e tenha cabeçalho. */
async function ensureSheet() {
  const { tab } = sheetsConfig();
  const tabs = await listTabs();
  if (!tabs.includes(tab)) await addTab(tab);
  const header = await getValues(`${tabRef(tab)}!A1:${LAST_COL}1`);
  if (!header.length || !header[0]?.length) {
    await updateValues(`${tabRef(tab)}!A1:${LAST_COL}1`, [SHEET_HEADER]);
  }
}

/** Só as linhas da aba de partidas (uma linha por partida). */
async function readPartidas(): Promise<Match[]> {
  const { tab } = sheetsConfig();
  await ensureSheet();
  const rows = await getValues(`${tabRef(tab)}!A2:${LAST_COL}`);
  const list: Match[] = [];
  rows.forEach((r, i) => {
    const m = rowToMatch(r, i + 2);
    if (m) list.push(m);
  });
  return sortMatches(list);
}

/** Ano do histórico da aba antiga (as colunas não trazem o ano). */
function legacyYear() {
  const y = Number(process.env.GOOGLE_LEGACY_YEAR);
  return Number.isInteger(y) && y > 2000 ? y : 2026;
}

/** Partidas da aba antiga ("Nucha & Manoel"). Se a aba não existir, devolve vazio. */
async function readLegacy(): Promise<Match[]> {
  const { legacyTab } = sheetsConfig();
  if (!legacyTab) return [];
  try {
    const grid = await getValues(`${tabRef(legacyTab)}!A1:ZZ23`);
    return grid.length ? parseLegacyGrid(grid, legacyYear()) : [];
  } catch (e) {
    console.warn("[kismet] aba antiga indisponível:", e instanceof Error ? e.message : e);
    return [];
  }
}

const slot = (m: Match) => `${m.year}-${m.month}-${m.number}`;

/**
 * Junta as duas fontes: a aba de partidas tem prioridade; partidas da aba antiga
 * entram apenas nos meses/números que ainda não existem na aba nova.
 */
async function readFromSheets(): Promise<Match[]> {
  const [partidas, legacy] = await Promise.all([readPartidas(), readLegacy()]);
  const taken = new Set(partidas.map(slot));
  return sortMatches([...partidas, ...legacy.filter((m) => !taken.has(slot(m)))]);
}

const readCached = unstable_cache(readFromSheets, ["kismet-matches-v2"], {
  tags: [MATCHES_TAG],
  revalidate: 300,
});

export async function getMatches(): Promise<MatchesResult> {
  if (!isSheetsConfigured()) return { matches: sortMatches(DEMO_MATCHES), source: "demo" };
  try {
    return { matches: await readCached(), source: "sheets" };
  } catch (e) {
    console.error("[kismet] erro lendo planilha:", e);
    return { matches: [], source: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/** Leitura sem cache — usada antes de gravar para checar conflitos. */
export async function getMatchesFresh(): Promise<Match[]> {
  if (!isSheetsConfigured()) return sortMatches(DEMO_MATCHES);
  return readFromSheets();
}

export class MatchConflictError extends Error {
  constructor(
    message: string,
    public existing: Match,
  ) {
    super(message);
  }
}

export async function saveMatch(match: Match, overwrite: boolean): Promise<"created" | "updated"> {
  const { tab } = sheetsConfig();
  const all = await readFromSheets();
  const sameSlot = all.find(
    (m) => m.year === match.year && m.month === match.month && m.number === match.number,
  );
  const monthCount = all.filter((m) => m.year === match.year && m.month === match.month).length;

  if (sameSlot) {
    if (!overwrite) {
      throw new MatchConflictError(`A partida ${match.number} deste mês já foi registrada.`, sameSlot);
    }
    // partida vinda da aba antiga: grava na aba nova, que passa a ter prioridade
    if (!sameSlot.row) {
      await appendValues(`${tabRef(tab)}!A:${LAST_COL}`, [matchToRow(match)]);
      return "updated";
    }
    await updateValues(`${tabRef(tab)}!A${sameSlot.row}:${LAST_COL}${sameSlot.row}`, [matchToRow(match)]);
    return "updated";
  }
  if (monthCount >= MATCHES_PER_MONTH) {
    throw new Error(`Este mês já tem ${MATCHES_PER_MONTH} partidas.`);
  }
  await appendValues(`${tabRef(tab)}!A:${LAST_COL}`, [matchToRow(match)]);
  return "created";
}

/** Importa a aba antiga ("Nucha & Manoel") para a aba de partidas, sem duplicar. */
export async function importLegacy(year: number): Promise<{ imported: number; skipped: number }> {
  const { tab, legacyTab } = sheetsConfig();
  const grid = await getValues(`${tabRef(legacyTab)}!A1:ZZ23`);
  if (!grid.length) throw new Error(`Aba "${legacyTab}" não encontrada ou vazia.`);
  const legacy = parseLegacyGrid(grid, year);
  const existing = await readPartidas();
  const taken = new Set(existing.map(slot));
  const fresh = legacy.filter((m) => !taken.has(slot(m)));
  if (fresh.length) await appendValues(`${tabRef(tab)}!A:${LAST_COL}`, fresh.map(matchToRow));
  return { imported: fresh.length, skipped: legacy.length - fresh.length };
}
