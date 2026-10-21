import "server-only";
import { clearValues, getValues, isSheetsConfigured, sheetsConfig, tabRef, updateValues } from "./google-sheets";
import { CATEGORIES, PLAYERS, type CategoryId, type PlayerId, type Scores } from "./kismet";
import { LEGACY_ROW, legacyYear } from "./legacy";

/**
 * Espelho das jogadas na aba "Nucha & Manoel" (o formato original, em colunas):
 * cada jogada salva no app é escrita na hora na célula da rodada/jogador/categoria.
 *
 *   coluna  → rodada e jogador, encontrada pelo cabeçalho (linha 2 = nº da rodada,
 *             linha 3 = Nucha / Manoel). Rodada 25: Nucha = BA, Manoel = BB.
 *   linha   → categoria (4–9 = Ases…Seis · 15–21 = 2 Pair…Kismet)
 *
 * As fórmulas da planilha (totais, bônus, vencedor) continuam calculando sozinhas.
 * Só escreve quando a rodada é do ano que a aba representa (GOOGLE_LEGACY_YEAR).
 */

function colLetter(n: number) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const legacyName = (p: PlayerId) => PLAYERS.find((x) => x.id === p)!.legacyName.toLowerCase();

let headerCache: { at: number; names: string[] } | null = null;

/** Linha 3 da aba (nomes dos jogadores por coluna), com cache de 10 min. */
async function namesRow(): Promise<string[]> {
  if (headerCache && Date.now() - headerCache.at < 10 * 60_000) return headerCache.names;
  const { legacyTab } = sheetsConfig();
  const row = (await getValues(`${tabRef(legacyTab)}!A3:CZ3`))[0] ?? [];
  const names = row.map((v) => String(v ?? "").trim().toLowerCase());
  headerCache = { at: Date.now(), names };
  return names;
}

/**
 * Coluna (letra) da rodada/jogador. Cada rodada ocupa 2 colunas a partir de E
 * (rodada 1 = E/F); confere o nome no cabeçalho antes de usar — se não bater,
 * não escreve nada (protege contra layout diferente).
 */
async function columnFor(round: number, player: PlayerId): Promise<string | null> {
  const names = await namesRow();
  const first = 5 + 2 * (round - 1); // E = 5
  for (const col of [first, first + 1]) {
    if (names[col - 1] === legacyName(player)) return colLetter(col);
  }
  return null;
}

function enabledFor(year: number) {
  return isSheetsConfigured() && year === legacyYear();
}

/** Escreve (ou limpa, com value = null) a célula de uma jogada. */
export async function writeLegacyPlay(
  live: { year: number; month: number; number: number },
  player: PlayerId,
  cat: CategoryId,
  value: number | null,
) {
  if (!enabledFor(live.year)) return;
  const round = (live.month - 1) * 3 + live.number;
  const col = await columnFor(round, player);
  if (!col) {
    console.warn(`[kismet] aba antiga: coluna da rodada ${round} (${player}) não encontrada`);
    return;
  }
  const { legacyTab } = sheetsConfig();
  const cell = `${tabRef(legacyTab)}!${col}${LEGACY_ROW[cat]}`;
  if (value === null) await clearValues(cell);
  else await updateValues(cell, [[value]]);
}

/** Regrava a coluna inteira de cada jogador (usado ao encerrar a partida). */
export async function writeLegacyRound(live: { year: number; month: number; number: number }, scores: Record<PlayerId, Scores>) {
  if (!enabledFor(live.year)) return;
  const round = (live.month - 1) * 3 + live.number;
  const { legacyTab } = sheetsConfig();
  for (const player of ["manoel", "ana"] as PlayerId[]) {
    const col = await columnFor(round, player);
    if (!col) continue;
    const upper = [4, 5, 6, 7, 8, 9].map((r) => [scores[player][rowCat(r)]]);
    const lower = [15, 16, 17, 18, 19, 20, 21].map((r) => [scores[player][rowCat(r)]]);
    await updateValues(`${tabRef(legacyTab)}!${col}4:${col}9`, upper);
    await updateValues(`${tabRef(legacyTab)}!${col}15:${col}21`, lower);
  }
}

/** Limpa as duas colunas da rodada (partida cancelada). */
export async function clearLegacyRound(live: { year: number; month: number; number: number }) {
  if (!enabledFor(live.year)) return;
  const round = (live.month - 1) * 3 + live.number;
  const { legacyTab } = sheetsConfig();
  for (const player of ["manoel", "ana"] as PlayerId[]) {
    const col = await columnFor(round, player);
    if (!col) continue;
    await clearValues(`${tabRef(legacyTab)}!${col}4:${col}9`);
    await clearValues(`${tabRef(legacyTab)}!${col}15:${col}21`);
  }
}

function rowCat(row: number): CategoryId {
  const id = (Object.entries(LEGACY_ROW) as [CategoryId, number][]).find(([, r]) => r === row)?.[0];
  if (!id) throw new Error(`linha ${row} sem categoria`);
  return id;
}

export const LEGACY_CATEGORIES = CATEGORIES.map((c) => c.id);
