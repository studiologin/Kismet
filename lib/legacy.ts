import { PLAYERS, zeroScores, type CategoryId, type Scores } from "./kismet";
import { MATCHES_PER_MONTH } from "./kismet";
import { buildMatch, type Match } from "./match";

/**
 * Converte o layout antigo da aba "Nucha & Manoel" (uma coluna por jogador,
 * partidas lado a lado, 3 por mês) para o modelo de uma linha por partida.
 *
 * Linhas da planilha antiga (1-based):
 *   3  → nomes (Nucha / Manoel)
 *   4–9   → Ases … Seis
 *   15–21 → 2 Pair, 3 of a kind, Straight, Full House, 4 of a kind, Yarborough, Kismet
 * Categorias que não existiam (Flush, Full House mesma cor) entram como 0.
 */

const LEGACY_UPPER_ROWS = [4, 5, 6, 7, 8, 9];
const LEGACY_UPPER_IDS: CategoryId[] = ["ases", "dois", "tres", "quatro", "cinco", "seis"];
const LEGACY_LOWER_ROWS = [15, 16, 17, 18, 19, 20, 21];
const LEGACY_LOWER_IDS: CategoryId[] = [
  "doisPares",
  "trinca",
  "sequencia",
  "fullHouse",
  "quadra",
  "yarborough",
  "kismet",
];

const toNum = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** 13 valores na ordem da planilha antiga → Scores */
export function legacyArrayToScores(values: number[]): Scores {
  const s = zeroScores();
  LEGACY_UPPER_IDS.forEach((id, i) => (s[id] = values[i] ?? 0));
  LEGACY_LOWER_IDS.forEach((id, i) => (s[id] = values[6 + i] ?? 0));
  return s;
}

export function legacyGameToMatch(game: number, year: number, manoel: number[], ana: number[]): Match {
  const month = Math.ceil(game / MATCHES_PER_MONTH);
  const number = ((game - 1) % MATCHES_PER_MONTH) + 1;
  return buildMatch({
    date: "",
    year,
    month,
    number,
    scores: { manoel: legacyArrayToScores(manoel), ana: legacyArrayToScores(ana) },
    registeredAt: "Importado do histórico",
  });
}

/** values = grade A1:ZZ23 da aba antiga (UNFORMATTED_VALUE) */
export function parseLegacyGrid(values: unknown[][], year: number): Match[] {
  const names = values[2] ?? [];
  const cell = (r: number, c: number) => toNum(values[r - 1]?.[c]);
  const anaName = PLAYERS.find((p) => p.id === "ana")!.legacyName.toLowerCase();
  const manoelName = PLAYERS.find((p) => p.id === "manoel")!.legacyName.toLowerCase();

  const matches: Match[] = [];
  let game = 0;
  for (let c = 0; c < names.length; c++) {
    const n = String(names[c] ?? "").trim().toLowerCase();
    if (n !== anaName && n !== manoelName) continue;
    const next = String(names[c + 1] ?? "").trim().toLowerCase();
    if (!next || next === n) continue;
    game++;
    const anaCol = n === anaName ? c : c + 1;
    const manoelCol = n === anaName ? c + 1 : c;
    const read = (col: number) => [
      ...LEGACY_UPPER_ROWS.map((r) => cell(r, col)),
      ...LEGACY_LOWER_ROWS.map((r) => cell(r, col)),
    ];
    const a = read(anaCol);
    const m = read(manoelCol);
    c++; // pula a coluna do par
    const hasData = [...a, ...m].some((v) => v > 0);
    if (!hasData || game > 12 * MATCHES_PER_MONTH) continue;
    matches.push(legacyGameToMatch(game, year, m, a));
  }
  return matches;
}
