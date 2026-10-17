import { PLAYERS, type PlayerId, type Winner } from "./kismet";
import { monthKey, sortMatches, type Match } from "./match";

export interface PlayerStats {
  wins: number;
  totalPoints: number;
  avg: number;
  max: number;
  maxMatch?: Match;
  kismets: number;
  bonuses: number;
  bestStreak: number;
}

export interface MonthSummary {
  key: string;
  year: number;
  month: number;
  matches: Match[];
  wins: Record<PlayerId, number>;
  ties: number;
  points: Record<PlayerId, number>;
  avg: Record<PlayerId, number>;
  cumulative: Record<PlayerId, number>;
  winner: Winner | null;
}

export interface Stats {
  played: number;
  ties: number;
  leader: Winner | null;
  lead: number;
  players: Record<PlayerId, PlayerStats>;
  currentStreak: { player: PlayerId; length: number } | null;
  months: MonthSummary[];
  biggestWin?: { match: Match; margin: number };
}

const ids = PLAYERS.map((p) => p.id) as PlayerId[];
const rec = <T,>(fn: (id: PlayerId) => T) =>
  Object.fromEntries(ids.map((id) => [id, fn(id)])) as Record<PlayerId, T>;

export function computeStats(input: Match[]): Stats {
  const matches = sortMatches(input);
  const players = rec<PlayerStats>(() => ({
    wins: 0,
    totalPoints: 0,
    avg: 0,
    max: 0,
    kismets: 0,
    bonuses: 0,
    bestStreak: 0,
  }));
  let ties = 0;
  let streak: { player: PlayerId; length: number } | null = null;
  let biggestWin: Stats["biggestWin"];

  for (const m of matches) {
    for (const id of ids) {
      const p = players[id];
      const total = m.totals[id].total;
      p.totalPoints += total;
      if (total > p.max) {
        p.max = total;
        p.maxMatch = m;
      }
      if (m.scores[id].kismet > 0) p.kismets++;
      if (m.totals[id].bonus > 0) p.bonuses++;
    }
    if (m.winner === "empate") {
      ties++;
      streak = null;
    } else {
      players[m.winner].wins++;
      streak = streak && streak.player === m.winner ? { player: m.winner, length: streak.length + 1 } : { player: m.winner, length: 1 };
      players[m.winner].bestStreak = Math.max(players[m.winner].bestStreak, streak.length);
      const margin = Math.abs(m.totals.manoel.total - m.totals.ana.total);
      if (!biggestWin || margin > biggestWin.margin) biggestWin = { match: m, margin };
    }
  }
  for (const id of ids) {
    players[id].avg = matches.length ? players[id].totalPoints / matches.length : 0;
  }

  // meses
  const byMonth = new Map<string, Match[]>();
  for (const m of matches) {
    const k = monthKey(m.year, m.month);
    byMonth.set(k, [...(byMonth.get(k) ?? []), m]);
  }
  const cumulative = rec(() => 0);
  const months: MonthSummary[] = [...byMonth.entries()].map(([key, list]) => {
    const wins = rec((id) => list.filter((m) => m.winner === id).length);
    const points = rec((id) => list.reduce((a, m) => a + m.totals[id].total, 0));
    for (const id of ids) cumulative[id] += wins[id];
    const winner: Winner | null =
      wins.manoel === wins.ana ? (list.length ? "empate" : null) : wins.manoel > wins.ana ? "manoel" : "ana";
    return {
      key,
      year: list[0].year,
      month: list[0].month,
      matches: list,
      wins,
      ties: list.filter((m) => m.winner === "empate").length,
      points,
      avg: rec((id) => points[id] / list.length),
      cumulative: { ...cumulative },
      winner,
    };
  });

  const diff = players.manoel.wins - players.ana.wins;
  return {
    played: matches.length,
    ties,
    leader: matches.length ? (diff === 0 ? "empate" : diff > 0 ? "manoel" : "ana") : null,
    lead: Math.abs(diff),
    players,
    currentStreak: streak,
    months,
    biggestWin,
  };
}
