import { Reveal } from "@/components/ui/Reveal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { MONTHS_SHORT } from "@/lib/dates";
import { PLAYER_NAME } from "@/lib/kismet";
import type { Match } from "@/lib/match";
import type { Stats } from "@/lib/stats";
import { DuelBar } from "./DuelBar";
import { SectionHeading } from "./SectionHeading";

const ref = (m?: Match) => (m ? `P${m.number} · ${MONTHS_SHORT[m.month - 1]}/${String(m.year).slice(2)}` : "");

export function StatsSection({ stats }: { stats: Stats }) {
  const { players: p, currentStreak, biggestWin } = stats;
  const record = p.manoel.max >= p.ana.max ? { who: "manoel" as const, ...p.manoel } : { who: "ana" as const, ...p.ana };

  const highlights = [
    {
      label: "Sequência atual",
      value: currentStreak?.length ?? 0,
      detail: currentStreak ? `${PLAYER_NAME[currentStreak.player]} vencendo` : "sem sequência",
      color: currentStreak?.player === "manoel" ? "text-manoel" : currentStreak?.player === "ana" ? "text-ana" : "text-paper",
    },
    {
      label: "Recorde de pontos",
      value: record.max,
      detail: `${PLAYER_NAME[record.who]} · ${ref(record.maxMatch)}`,
      color: "text-gold",
    },
    {
      label: "Maior vitória",
      value: biggestWin?.margin ?? 0,
      prefix: "+",
      detail: biggestWin && biggestWin.match.winner !== "empate"
        ? `${PLAYER_NAME[biggestWin.match.winner]} · ${ref(biggestWin.match)}`
        : "—",
      color: biggestWin?.match.winner === "manoel" ? "text-manoel" : "text-ana",
    },
  ];

  return (
    <section id="estatisticas" className="relative scroll-mt-24 py-20 sm:py-28">
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-ink-2 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          index="02"
          eyebrow="Estatísticas"
          title={
            <>
              Duelo em <span className="shine-text">números</span>
            </>
          }
          aside={
            <Reveal delay={0.1} className="flex items-center gap-4 text-sm font-bold">
              <span className="flex items-center gap-2 text-manoel"><span className="size-2 rounded-full bg-manoel" />Manoel</span>
              <span className="flex items-center gap-2 text-ana"><span className="size-2 rounded-full bg-ana" />Ana</span>
            </Reveal>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Reveal className="glass space-y-7 rounded-[2rem] p-5 sm:p-8">
            <DuelBar label="Vitórias" manoel={p.manoel.wins} ana={p.ana.wins} />
            <DuelBar label="Média de pontos" manoel={p.manoel.avg} ana={p.ana.avg} decimals={1} />
            <DuelBar
              label="Maior pontuação"
              manoel={p.manoel.max}
              ana={p.ana.max}
             
              note={`${ref(p.manoel.maxMatch)}  ·  ${ref(p.ana.maxMatch)}`}
            />
            <DuelBar label="Kismets" manoel={p.manoel.kismets} ana={p.ana.kismets} note="5 dados iguais" />
            <DuelBar label="Bônus superior" manoel={p.manoel.bonuses} ana={p.ana.bonuses} note="63+ pontos em Ases–Seis" />
            <DuelBar label="Melhor sequência" manoel={p.manoel.bestStreak} ana={p.ana.bestStreak} note="vitórias seguidas" />
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
            {highlights.map((h, i) => (
              <Reveal key={h.label} delay={0.1 + i * 0.08} className="glass relative overflow-hidden rounded-[1.75rem] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-mist">{h.label}</p>
                <p className={`mt-2 font-display text-5xl font-extrabold tabular sm:text-6xl ${h.color}`}>
                  <AnimatedNumber value={h.value} prefix={h.prefix} />
                </p>
                <p className="mt-1 text-sm text-fog">{h.detail}</p>
                <span aria-hidden className="text-outline absolute -bottom-6 -right-2 font-display text-8xl font-extrabold">
                  {i + 1}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
