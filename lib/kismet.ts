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
  | { kind: "sum"; bonus: number; step?: number }; // jogador informa a soma dos dados (5–30); grava soma + bônus

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
  | "fullHouse"
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
  { id: "doisPares", label: "Dois pares", short: "2P", hint: "soma dos dados", section: "lower", rule: { kind: "sum", bonus: 0 } },
  { id: "trinca", label: "Trinca", short: "3x", hint: "soma dos dados", section: "lower", rule: { kind: "sum", bonus: 0 } },
  { id: "sequencia", label: "Sequência", short: "SQ", hint: "30 pontos", section: "lower", rule: { kind: "fixed", value: 30 } },
  { id: "fullHouse", label: "Full House", short: "FH", hint: "soma + 15", section: "lower", rule: { kind: "sum", bonus: 15 } },
  { id: "quadra", label: "Quadra", short: "4x", hint: "soma + 35", section: "lower", rule: { kind: "sum", bonus: 35 } },
  { id: "yarborough", label: "Yarborough", short: "YB", hint: "soma dos dados", section: "lower", rule: { kind: "sum", bonus: 0 } },
  // Kismet = 5 dados iguais → a soma é sempre múltiplo de 5 (5, 10 … 30)
  { id: "kismet", label: "Kismet", short: "K!", hint: "soma + 50", section: "lower", rule: { kind: "sum", bonus: 50, step: 5 } },
];

export const DICE_SUM = { min: DICE_MIN, max: DICE_MAX };

/** Soma dos dados → pontos da categoria (0 continua 0 = riscou). */
export function sumToValue(cat: Category, sum: number): number {
  if (cat.rule.kind !== "sum" || sum === 0) return sum;
  return sum + cat.rule.bonus;
}

/** Pontos gravados → soma dos dados informada pelo jogador. */
export function valueToSum(cat: Category, value: number): number {
  if (cat.rule.kind !== "sum" || value === 0) return value;
  return value - cat.rule.bonus;
}

/** Valida a soma dos dados digitada (mensagem pensada para quem está jogando). */
export function validateSum(cat: Category, sum: number | null): string | null {
  if (cat.rule.kind !== "sum") return null;
  if (sum === null || Number.isNaN(sum)) return "Informe a soma (0 se riscou)";
  if (sum === 0) return null;
  if (!Number.isInteger(sum) || sum < DICE_MIN || sum > DICE_MAX) return `Soma entre ${DICE_MIN} e ${DICE_MAX}`;
  if (cat.rule.step && sum % cat.rule.step !== 0) return `5 dados iguais: 5, 10, 15, 20, 25 ou 30`;
  return null;
}

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
    case "sum": {
      const sum = value - r.bonus;
      if (sum < DICE_MIN || sum > DICE_MAX) return `0 ou ${DICE_MIN + r.bonus}–${DICE_MAX + r.bonus}`;
      if (r.step && sum % r.step !== 0) return "Kismet: soma múltipla de 5";
      return null;
    }
  }
}

export function emptyScores(): Record<CategoryId, number | null> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, null])) as Record<CategoryId, number | null>;
}

export function zeroScores(): Scores {
  return Object.fromEntries(CATEGORIES.map((c) => [c.id, 0])) as Scores;
}
