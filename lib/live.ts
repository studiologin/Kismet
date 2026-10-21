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
import { CATEGORIES, type CategoryId, type PlayerId } from "./kismet";

/**
 * Partida ao vivo: cada jogador preenche a própria coluna no celular e o outro
 * acompanha em tempo real. O estado fica numa aba "AoVivo" da planilha, com no
 * máximo uma linha por jogador — cada um só escreve a sua linha, então não há
 * conflito de edição. Ao finalizar, a partida vai para a aba Partidas e a aba
 * AoVivo é limpa.
 *
 * Sem Google configurado (desenvolvimento/demonstração), usa memória do servidor.
 */

export type LiveScores = Partial<Record<CategoryId, number | null>>;

export interface LiveMeta {
  key: string; // 2026-10-P1
  date: string; // ISO
  year: number;
  month: number;
  number: number;
  overwrite: boolean;
  startedBy: PlayerId;
}

export interface LiveEntry {
  scores: LiveScores;
  updatedAt: string; // ISO
}

export interface LiveState extends LiveMeta {
  entries: Partial<Record<PlayerId, LiveEntry>>;
}

const HEADER = ["Chave", "Dados da partida", "Jogador", "Pontuação", "Atualizado em"];

/* ───────────── armazenamento ───────────── */

interface Row {
  meta: LiveMeta;
  player: PlayerId;
  entry: LiveEntry;
  rowNumber?: number;
}

const memory: { rows: Row[] } = { rows: [] };

function cleanScores(input: unknown): LiveScores {
  const out: LiveScores = {};
  if (!input || typeof input !== "object") return out;
  for (const c of CATEGORIES) {
    const v = (input as Record<string, unknown>)[c.id];
    if (v === null || v === undefined || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) out[c.id] = Math.trunc(n);
  }
  return out;
}

async function ensureLiveTab() {
  const { liveTab } = sheetsConfig();
  const tabs = await listTabs();
  if (!tabs.includes(liveTab)) {
    await addTab(liveTab);
    await updateValues(`${tabRef(liveTab)}!A1:E1`, [HEADER]);
  }
}

async function readRows(): Promise<Row[]> {
  if (!isSheetsConfigured()) return memory.rows;
  const { liveTab } = sheetsConfig();
  let values: unknown[][] = [];
  try {
    values = await getValues(`${tabRef(liveTab)}!A2:E10`);
  } catch (e) {
    // aba ainda não existe → nenhuma partida em andamento
    if (e instanceof Error && /Unable to parse range|not found/i.test(e.message)) return [];
    throw e;
  }
  const rows: Row[] = [];
  values.forEach((r, i) => {
    try {
      const player = String(r[2] ?? "") as PlayerId;
      if (player !== "manoel" && player !== "ana") return;
      const meta = JSON.parse(String(r[1] ?? "")) as LiveMeta;
      rows.push({
        meta,
        player,
        entry: { scores: cleanScores(JSON.parse(String(r[3] ?? "{}"))), updatedAt: String(r[4] ?? "") },
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
  // a partida ativa é a da linha mais antiga (quem iniciou); linhas de outra chave são descartadas
  const meta = rows[0].meta;
  const entries: LiveState["entries"] = {};
  for (const r of rows) if (r.meta.key === meta.key) entries[r.player] = r.entry;
  return { ...meta, entries };
}

/* cache curtíssimo em memória: dois celulares consultando a cada poucos segundos
   não estouram a cota da API do Google (60 leituras/min por conta). */
let memo: { at: number; state: LiveState | null } | null = null;
const MEMO_MS = 2000;

export async function getLiveState(fresh = false): Promise<LiveState | null> {
  if (!fresh && memo && Date.now() - memo.at < MEMO_MS) return memo.state;
  const state = toState(await readRows());
  memo = { at: Date.now(), state };
  return state;
}

async function writeRow(meta: LiveMeta, player: PlayerId, entry: LiveEntry) {
  memo = null;
  if (!isSheetsConfigured()) {
    const i = memory.rows.findIndex((r) => r.player === player);
    const row = { meta, player, entry };
    if (i >= 0) memory.rows[i] = row;
    else memory.rows.push(row);
    return;
  }
  const { liveTab } = sheetsConfig();
  await ensureLiveTab();
  const rows = await readRows();
  const existing = rows.find((r) => r.player === player);
  const values = [[meta.key, JSON.stringify(meta), player, JSON.stringify(entry.scores), entry.updatedAt]];
  if (existing?.rowNumber) {
    await updateValues(`${tabRef(liveTab)}!A${existing.rowNumber}:E${existing.rowNumber}`, values);
  } else {
    await appendValues(`${tabRef(liveTab)}!A:E`, values);
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
    await clearValues(`${tabRef(liveTab)}!A2:E10`);
  } catch {
    /* aba inexistente: nada a limpar */
  }
}

/* ───────────── operações ───────────── */

export async function startLive(meta: LiveMeta) {
  const current = await getLiveState(true);
  if (current && current.key !== meta.key) {
    throw new Error(`Já existe uma partida em andamento (partida ${current.number} de ${current.month}/${current.year}).`);
  }
  if (current) return current; // mesma partida: só entra nela
  await writeRow(meta, meta.startedBy, { scores: {}, updatedAt: new Date().toISOString() });
  return getLiveState(true);
}

export async function saveLiveScores(player: PlayerId, scores: unknown) {
  const current = await getLiveState(true);
  if (!current) throw new Error("Nenhuma partida em andamento.");
  const meta: LiveMeta = {
    key: current.key,
    date: current.date,
    year: current.year,
    month: current.month,
    number: current.number,
    overwrite: current.overwrite,
    startedBy: current.startedBy,
  };
  await writeRow(meta, player, { scores: cleanScores(scores), updatedAt: new Date().toISOString() });
  return getLiveState(true);
}
