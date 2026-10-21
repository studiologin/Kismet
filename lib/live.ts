import "server-only";
import {
  addTab,
  appendValues,
  clearValues,
  getValues,
  isSheetsConfigured,
  listTabs,
  sheetsConfig,
  tabRef,
  updateValues,
} from "./google-sheets";
import { CATEGORIES, PLAYER_NAME, validateScore, type CategoryId, type PlayerId } from "./kismet";
import { nextTurn, scoresFromPlays, type LiveEntry, type LiveMeta, type LiveState, type Play } from "./turns";

export type { LiveEntry, LiveMeta, LiveState, Play } from "./turns";

/**
 * Partida ao vivo por turnos. Cada jogada (uma categoria por vez) é salva na
 * hora e a vez passa para o outro jogador. O estado fica numa aba "AoVivo" da
 * planilha, com uma linha por jogador — cada um só escreve a própria linha.
 * Ao finalizar, a partida vai para a aba Partidas e a AoVivo é limpa.
 *
 * Sem Google configurado (desenvolvimento/demonstração), usa memória do servidor.
 */

const HEADER = ["Chave", "Dados da partida", "Jogador", "Pontuação", "Atualizado em", "Jogadas"];
const RANGE_ROWS = "A2:F10";

interface Row {
  meta: LiveMeta;
  player: PlayerId;
  entry: LiveEntry;
  rowNumber?: number;
}

const memory: { rows: Row[] } = { rows: [] };

const CAT_IDS = new Set<string>(CATEGORIES.map((c) => c.id));

function parsePlays(raw: unknown): Play[] {
  if (!Array.isArray(raw)) return [];
  const out: Play[] = [];
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const { cat, value, at } = p as Record<string, unknown>;
    if (typeof cat !== "string" || !CAT_IDS.has(cat)) continue;
    const n = Number(value);
    if (!Number.isFinite(n)) continue;
    out.push({ cat: cat as CategoryId, value: Math.trunc(n), at: String(at ?? "") });
  }
  return out;
}

async function ensureLiveTab() {
  const { liveTab } = sheetsConfig();
  const tabs = await listTabs();
  if (!tabs.includes(liveTab)) await addTab(liveTab);
  await updateValues(`${tabRef(liveTab)}!A1:F1`, [HEADER]);
}

async function readRows(): Promise<Row[]> {
  if (!isSheetsConfigured()) return memory.rows;
  const { liveTab } = sheetsConfig();
  let values: unknown[][] = [];
  try {
    values = await getValues(`${tabRef(liveTab)}!${RANGE_ROWS}`);
  } catch (e) {
    if (e instanceof Error && /Unable to parse range|not found/i.test(e.message)) return [];
    throw e;
  }
  const rows: Row[] = [];
  values.forEach((r, i) => {
    try {
      const player = String(r[2] ?? "") as PlayerId;
      if (player !== "manoel" && player !== "ana") return;
      const meta = JSON.parse(String(r[1] ?? "")) as LiveMeta;
      const plays = parsePlays(JSON.parse(String(r[5] || "[]")));
      rows.push({
        meta,
        player,
        entry: { plays, scores: scoresFromPlays(plays), updatedAt: String(r[4] ?? "") },
        rowNumber: i + 2,
      });
    } catch {
      /* linha inválida: ignora */
    }
  });
  return rows;
}

function toState(rows: Row[]): LiveState | null {
  if (!rows.length) return null;
  const meta = rows[0].meta;
  const entries: LiveState["entries"] = {};
  for (const r of rows) if (r.meta.key === meta.key) entries[r.player] = r.entry;
  const state: LiveState = { ...meta, firstPlayer: meta.firstPlayer ?? meta.startedBy, entries, turn: null };
  state.turn = nextTurn(state);
  return state;
}

/* cache curtíssimo: dois celulares consultando a cada poucos segundos não
   estouram a cota da API do Google (60 leituras/min por conta). */
let memo: { at: number; state: LiveState | null } | null = null;
const MEMO_MS = 2000;

export async function getLiveState(fresh = false): Promise<LiveState | null> {
  if (!fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.state;
  const state = toState(await readRows());
  memo = { at: Date.now(), state };
  return state;
}

async function writeRow(meta: LiveMeta, player: PlayerId, plays: Play[]) {
  memo = null;
  const updatedAt = new Date().toISOString();
  const entry: LiveEntry = { plays, scores: scoresFromPlays(plays), updatedAt };
  if (!isSheetsConfigured()) {
    const i = memory.rows.findIndex((r) => r.player === player);
    const row = { meta, player, entry };
    if (i >= 0) memory.rows[i] = row;
    else memory.rows.push(row);
    return;
  }
  const { liveTab } = sheetsConfig();
  const rows = await readRows();
  const existing = rows.find((r) => r.player === player);
  const values = [[meta.key, JSON.stringify(meta), player, JSON.stringify(entry.scores), updatedAt, JSON.stringify(plays)]];
  if (existing?.rowNumber) {
    await updateValues(`${tabRef(liveTab)}!A${existing.rowNumber}:F${existing.rowNumber}`, values);
  } else {
    if (!rows.length) await ensureLiveTab();
    await appendValues(`${tabRef(liveTab)}!A:F`, values);
  }
}

export async function clearLive() {
  memo = null;
  if (!isSheetsConfigured()) {
    memory.rows = [];
    return;
  }
  const { liveTab } = sheetsConfig();
  try {
    await clearValues(`${tabRef(liveTab)}!${RANGE_ROWS}`);
  } catch {
    /* aba inexistente: nada a limpar */
  }
}

const metaOf = (s: LiveState): LiveMeta => ({
  key: s.key,
  date: s.date,
  year: s.year,
  month: s.month,
  number: s.number,
  overwrite: s.overwrite,
  startedBy: s.startedBy,
  firstPlayer: s.firstPlayer,
});

/* ───────────── operações ───────────── */

export async function startLive(meta: LiveMeta) {
  const current = await getLiveState(true);
  if (current && current.key !== meta.key) {
    throw new Error(`Já existe uma partida em andamento (${current.number}ª de ${current.month}/${current.year}).`);
  }
  if (current) return current; // mesma partida: só entra nela
  await writeRow(meta, meta.startedBy, []);
  return getLiveState(true);
}

/** Salva UMA jogada do jogador (uma categoria) e passa a vez. */
export async function saveLivePlay(player: PlayerId, cat: CategoryId, value: number) {
  const state = await getLiveState(true);
  if (!state) throw new Error("Nenhuma partida em andamento.");
  const category = CATEGORIES.find((c) => c.id === cat);
  if (!category) throw new Error("Categoria inválida.");
  if (state.turn === null) throw new Error("As duas cartelas já estão completas.");
  if (state.turn !== player) throw new Error(`Agora é a vez de ${PLAYER_NAME[state.turn]}.`);
  const plays = state.entries[player]?.plays ?? [];
  if (plays.some((p) => p.cat === cat)) throw new Error(`${category.label} já foi marcado.`);
  const err = validateScore(category, value);
  if (err) throw new Error(`${category.label}: ${err}`);
  await writeRow(metaOf(state), player, [...plays, { cat, value, at: new Date().toISOString() }]);
  return getLiveState(true);
}

/** Desfaz a última jogada do jogador — só se ninguém jogou depois dela. */
export async function undoLivePlay(player: PlayerId) {
  const state = await getLiveState(true);
  if (!state) throw new Error("Nenhuma partida em andamento.");
  const mine = state.entries[player]?.plays ?? [];
  const last = mine.at(-1);
  if (!last) throw new Error("Você ainda não marcou nenhuma jogada.");
  const other: PlayerId = player === "manoel" ? "ana" : "manoel";
  const otherLast = state.entries[other]?.plays.at(-1);
  if (otherLast && otherLast.at > last.at) {
    throw new Error(`${PLAYER_NAME[other]} já jogou depois — não dá mais para desfazer.`);
  }
  await writeRow(metaOf(state), player, mine.slice(0, -1));
  return getLiveState(true);
}
