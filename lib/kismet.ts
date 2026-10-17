/**
 * Regras do Kismet usadas pela dupla Manoel x Ana.
 * Os bônus seguem a planilha original (Quadra = soma dos dados + 35).
 * Ajuste aqui se as regras da casa mudarem — validação, cálculo e cabeçalho
 * da planilha leem tudo deste arquivo.
 */

export const PLAYERS = [
  { id: "manoel", name: "Manoel", legacyName: "Manoel" },
  { id: "ana", name: "Ana", legacyName: "Nucha" },
] as const;

export type PlayerId = (typeof PLAYERS)[number]["id"];
export type Winner = PlayerId | "empate";

export const PLAYER_NAME: Record<PlayerId, string> = {
  manoel: "Manoel",
  ana: "Ana",
};

export const MATCHES_PER_MONTH = 3;

type Rule =
  | { kind: "multiple"; face: number } // seção superior: múltiplos da face, até 5 dados
  | { kind: "fixed"; value: number } // 0 ou valor fixo
  | { kind: "range"; min: number; max: number }; // 0 ou intervalo

export type CategoryId =
  | "ases"
  | "dois"
  | "tres"
  | "quatro"
  | "cinco"
  | "seis"
  | "doisPares"
  | "trinca"
  | "sequencia"
  | "flush"
  | "fullHouse"
  | "fullHouseCor"
  | "quadra"
  | "yarborough"
  | "kismet";

export interface Category {
  id: CategoryId;
  label: string;
  short: string;
  hint: string;
  section: "upper" | "lower";
  rule: Rule;
}

const DICE_MIN = 5; // 5 dados valendo 1
const DICE_MAX = 30; // 5 dados valendo 6

export const CATEGORIES: Category[] = [
  { id: "ases", label: "Ases", short: "1", hint: "1 por ás", section: "upper", rule: { kind: "multiple", face: 1 } },
  { id: "dois", label: "Dois", short: "2", hint: "2 por dado", section: "upper", rule: { kind: "multiple", face: 2 } },
  { id: "tres", label: "Três", short: "3", hint: "3 por dado", section: "upper", rule: { kind: "multiple", face: 3 } },
  { id: "quatro", label: "Quatro", short: "4", hint: "4 por dado", section: "upper", rule: { kind: "multiple", face: 4 } },
  { id: "cinco", label: "Cinco", short: "5", hint: "5 por dado", section: "upper", rule: { kind: "multiple", face: 5 } },
  { id: "seis", label: "Seis", short: "6", hint: "6 por dado", section: "upper", rule: { kind: "multiple", face: 6 } },
  { id: "doisPares", label: "Dois pares mesma cor", short: "2P", hint: "soma dos dados", section: "lower", rule: { kind: "range", min: DICE_MIN, max: DICE_MAX } },
  { id: "trinca", label: "Trinca", short: "3x", hint: "soma dos dados", section: "lower", rule: { kind: "range", min: DICE_MIN, max: DICE_MAX } },
  { id: "sequencia", label: "Sequência", short: "SQ", hint: "30 pontos", section: "lower", rule: { kind: "fixed", value: 30 } },
  { id: "flush", label: "Flush", short: "FL", hint: "35 pontos", section: "lower", rule: { kind: "fixed", value: 35 } },
  { id: "fullHouse", label: "Full House", short: "FH", hint: "soma + 15", section: "lower", rule: { kind: "range", min: DICE_MIN + 15, max: DICE_MAX + 15 } },
  { id: "fullHouseCor", label: "Full House mesma cor", short: "FC", hint: "soma + 20", section: "lower", rule: { kind: "range", min: DICE_MIN + 20, max: DICE_MAX + 20 } },
  { id: "quadra", label: "Quadra", short: "4x", hint: "soma + 35", section: "lower", rule: { kind: "range", min: DICE_MIN + 35, max: DICE_MAX + 35 } },
  { id: "yarborough", label: "Yarborough", short: "YB", hint: "soma dos dados", section: "lower", rule: { kind: "range", min: DICE_MIN, max: DICE_MAX } },
  { id: "kismet", label: "Kismet", short: "K!", hint: "soma + 50", section: "lower", rule: { kind: "range", min: DICE_MIN + 50, max: DICE_MAX + 50 } },
];

export const UPPER = CATEGORIES.filter((c) => c.section === "upper");
export const LOWER = CATEGORIES.filter((c) => c.section === "lower");

/** Bônus da seção superior: 63–70 → 35 · 71–77 → 55 · 78+ → 75 */
export const BONUS_TIERS = [
  { min: 78, bonus: 75 },
  { min: 71, bonus: 55 },
  { min: 63, bonus: 35 },
] as const;

export type Scores = Record<CategoryId, number>;

export interface PlayerTotals {
  upperSubtotal: number;
  bonus: number;
  upperTotal: number;
  lowerTotal: number;
  total: number;
}

export function upperBonus(subtotal: number): number {
  for (const t of BONUS_TIERS) if (subtotal >= t.min) return t.bonus;
  return 0;
}

export function nextBonusTier(subtotal: number): { missing: number; bonus: number } | null {
  const tiers = [...BONUS_TIERS].reverse();
  for (const t of tiers) if (subtotal < t.min) return { missing: t.min - subtotal, bonus: t.bonus };
  return null;
}

export function computeTotals(s: Partial<Scores>): PlayerTotals {
  const v = (id: CategoryId) => (Number.isFinite(s[id]) ? (s[id] as number) : 0);
  const upperSubtotal = UPPER.reduce((acc, c) => acc + v(c.id), 0);
  const bonus = upperBonus(upperSubtotal);
  const upperTotal = upperSubtotal + bonus;
  const lowerTotal = LOWER.reduce((acc, c) => acc + v(c.id), 0);
  return { upperSubtotal, bonus, upperTotal, lowerTotal, total: upperTotal + lowerTotal };
}

export function decideWinner(manoel: number, ana: number): Winner {
  if (manoel === ana) return "empate";
  return manoel > ana ? "manoel" : "ana";
}

/** Retorna mensagem de erro ou null se o valor for válido para a categoria. */
export function validateScore(cat: Category, value: number | null | undefined): string | null {
  if (value === null || value === undefined || Number.isNaN(value)) return "Preencha (0 se riscou)";
  if (!Number.isInteger(value)) return "Use número inteiro";
  if (value < 0) return "Não pode ser negativo";
  if (value === 0) return null;
  const r = cat.rule;
  switch (r.kind) {
    case "multiple":
      if (value % r.face !== 0) return `Múltiplo de ${r.face}`;
      if (value > r.face * 5) return `Máx. ${r.face * 5}`;
      return null;
    case "fixed":
      return value === r.value ? null : `0 ou ${r.value}`;
    case "range":
      return value >= r.min && value <= r.max ? null : `0 ou ${r.min}–${r.max}`;
  }
}

export function emptyScores(): Record<CategoryId, number | null> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, null])) as Record<CategoryId, number | null>;
}

export function zeroScores(): Scores {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Scores;
}
