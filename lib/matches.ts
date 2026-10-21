import "server-only";
import { unstable_cache } from "next/cache";
import { DEMO_MATCHES } from "./demo-data";
import {
  addTab,
  clearValues,
  appendValues,
  getValues,
  isSheetsConfigured,
  listTabs,
  sheetsConfig,
  tabRef,
  updateValues,
} from "./google-sheets";
import { MATCHES_PER_MONTH } from "./kismet";
import { legacyYear, parseLegacyGrid } from "./legacy";
import { getLiveState } from "./live";
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
/** Colunas do formato antigo (com Flush e Full House mesma cor) — usadas só na migração. */
const OLD_DROP = [16, 18, 36, 38]; // Manoel/Ana · Flush e Full House mesma cor
const OLD_WIDTH = 46;

let headerChecked = false;

/** Garante que a aba exista e tenha o cabeçalho atual (migra o formato antigo, se preciso). */
async function ensureSheet() {
  const { tab } = sheetsConfig();
  if (headerChecked) return;
  const tabs = await listTabs();
  if (!tabs.includes(tab)) await addTab(tab);
  const header = (await getValues(`${tabRef(tab)}!A1:AZ1`))[0] ?? [];
  const same = header.length === SHEET_HEADER.length && SHEET_HEADER.every((h, i) => header[i] === h);
  if (!same) {
    if (header.some((h) => String(h).includes("Flush"))) {
      // formato antigo: remove as colunas de Flush/Full House mesma cor e regrava as linhas
      const rows = await getValues(`${tabRef(tab)}!A2:AZ`);
      const migrated: (string | number)[][] = [];
      rows.forEach((r, i) => {
        const padded = Array.from({ length: OLD_WIDTH }, (_, k) => (r[k] ?? "") as string | number);
        const reduced = padded.filter((_, k) => !OLD_DROP.includes(k));
        const m = rowToMatch(reduced, i + 2);
        if (m) migrated.push(matchToRow(m));
      });
      await clearValues(`${tabRef(tab)}!A1:AZ${rows.length + 1}`);
      await updateValues(`${tabRef(tab)}!A1:${LAST_COL}${migrated.length + 1}`, [SHEET_HEADER, ...migrated]);
    } else {
      await updateValues(`${tabRef(tab)}!A1:${LAST_COL}1`, [SHEET_HEADER]);
    }
  }
  headerChecked = true;
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
  const [partidas, legacy, live] = await Promise.all([
    readPartidas(),
    readLegacy(),
    getLiveState().catch(() => null),
  ]);
  const taken = new Set(partidas.map(slot));
  // a rodada em andamento já tem jogadas escritas na aba antiga, mas ainda não terminou
  if (live) taken.add(`${live.year}-${live.month}-${live.number}`);
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
