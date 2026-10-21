import "server-only";
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


/** Partidas da tabela "Nucha & Manoel". `null` = aba indisponível (aí vale a aba Partidas). */
async function readLegacy(): Promise<Match[] | null> {
  const { legacyTab } = sheetsConfig();
  if (!legacyTab) return null;
  try {
    const grid = await getValues(`${tabRef(legacyTab)}!A1:ZZ23`);
    return grid.length ? parseLegacyGrid(grid, legacyYear()) : null;
  } catch (e) {
    console.warn("[kismet] aba antiga indisponível:", e instanceof Error ? e.message : e);
    return null;
  }
}

const slot = (m: Match) => `${m.year}-${m.month}-${m.number}`;

/**
 * A tabela "Nucha & Manoel" é a fonte da verdade do ano dela: o que está lá é o
 * que o site mostra (se uma coluna for apagada ou corrigida na planilha, o site
 * acompanha). A aba Partidas só vale para outros anos ou se a tabela não puder
 * ser lida.
 */
async function readFromSheets(): Promise<Match[]> {
  const [partidas, legacy, live] = await Promise.all([
    readPartidas(),
    readLegacy(),
    getLiveState(true).catch(() => null),
  ]);
  if (!legacy) return partidas;
  const year = legacyYear();
  // a rodada em andamento já tem jogadas escritas na tabela, mas ainda não terminou
  const liveSlot = live ? `${live.year}-${live.month}-${live.number}` : null;
  return sortMatches([
    ...partidas.filter((m) => m.year !== year),
    ...legacy.filter((m) => slot(m) !== liveSlot),
  ]);
}

/*
 * Sem cache de páginas: cada visita lê a planilha, então o que foi editado à mão
 * aparece na hora. Um memo de poucos segundos (por instância) só evita ler várias
 * vezes na mesma visita (layout + página) e protege a cota da API do Google.
 */
const MEMO_MS = 5000;
let memo: { at: number; data: Promise<Match[]> } | null = null;

function readCached(): Promise<Match[]> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.data;
  const data = readFromSheets();
  memo = { at: Date.now(), data };
  data.catch(() => (memo = null));
  return data;
}

/** Descarta a leitura em memória (depois de gravar). */
export function invalidateMatches() {
  memo = null;
}

/** `fresh`: lê a planilha agora, sem cache (tela de partida — a próxima rodada precisa ser a real). */
export async function getMatches(opts: { fresh?: boolean } = {}): Promise<MatchesResult> {
  if (!isSheetsConfigured()) return { matches: sortMatches(DEMO_MATCHES), source: "demo" };
  try {
    return { matches: await (opts.fresh ? readFromSheets() : readCached()), source: "sheets" };
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

  if (sameSlot && !overwrite) {
    throw new MatchConflictError(`A partida ${match.number} deste mês já foi registrada.`, sameSlot);
  }
  if (!sameSlot && monthCount >= MATCHES_PER_MONTH) {
    throw new Error(`Este mês já tem ${MATCHES_PER_MONTH} partidas.`);
  }
  // na aba Partidas, a linha da mesma rodada (mesmo que antiga/ignorada) é substituída — nunca duplica
  const row = (await readPartidas()).find((m) => slot(m) === slot(match))?.row;
  if (row) {
    await updateValues(`${tabRef(tab)}!A${row}:${LAST_COL}${row}`, [matchToRow(match)]);
  } else {
    await appendValues(`${tabRef(tab)}!A:${LAST_COL}`, [matchToRow(match)]);
  }
  invalidateMatches();
  return sameSlot ? "updated" : "created";
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
