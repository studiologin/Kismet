import type { Match } from "./match";

/**
 * "Carimbo" dos dados: muda sempre que uma partida é gravada, sobrescrita ou
 * editada. O app compara o carimbo da página aberta com o do servidor para
 * avisar que há resultados novos.
 */
export function dataStamp(matches: Match[]): string {
  let h = 5381;
  const src = matches.map((m) => `${m.id}:${m.totals.manoel.total}:${m.totals.ana.total}`).join("|");
  for (let i = 0; i < src.length; i++) h = ((h << 5) + h + src.charCodeAt(i)) | 0;
  return `${matches.length}-${(h >>> 0).toString(36)}`;
}

export const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";
